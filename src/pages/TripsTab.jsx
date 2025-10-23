import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import toast from 'react-hot-toast';

// Trips Tab Component
const TripsTab = ({ vehicles, onRefreshVehicles }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markersRef = useRef([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    waypoints: [], // [{address, coords} ...] first=start, last=end
    route: [],
    distanceKm: 0,
    startDate: '',
    endDate: '',
    vehicleId: '',
    driverId: '',
    driverBata: 0,
    ratePerKm: 0,
    vehicleRent: 0,
    totalAmount: 0,
    numDays: 1
  });
  const [suggestions, setSuggestions] = useState({ start: [], end: [] });
  const [unavailable, setUnavailable] = useState({ vehicles: new Set(), drivers: new Set() });

  useEffect(() => {
    // lazy init map
    if (!mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: false, // avoid page scroll hijack
        preferCanvas: true
      }).setView([20.5937, 78.9629], 5);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(mapInstanceRef.current);
    }
  }, []);

  // ensure we always have at least Start and Destination inputs
  useEffect(() => {
    setForm(prev => {
      if (!prev.waypoints || prev.waypoints.length < 2) {
        return { ...prev, waypoints: [{ address: '', coords: null }, { address: '', coords: null }] };
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    // fetch drivers list for dropdown (available + hired)
    const load = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const [avail, hired] = await Promise.all([
          axios.get('/api/drivers/available', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/drivers/hired', { headers: { Authorization: `Bearer ${token}` } })
        ]);
        const av = Array.isArray(avail.data.drivers) ? avail.data.drivers : [];
        const hd = Array.isArray(hired.data.drivers) ? hired.data.drivers : [];
        // merge unique by _id/id
        const map = new Map();
        [...av, ...hd].forEach(d => map.set(String(d._id || d.id), d));
        setDrivers(Array.from(map.values()));
      } catch (e) {
        console.error(e);
      }
    };
    load();
    onRefreshVehicles?.();
  }, []);

  const searchPlace = async (q) => {
    if (!q || q.length < 3) return [];
    // restrict to India using countrycodes=IN & bounded view
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=IN`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    const data = await res.json();
    return data.map(item => ({
      display: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon)
    }));
  };

  const handleSearchChange = async (index, value) => {
    setForm(prev => {
      const next = { ...prev };
      next.waypoints[index] = { ...(next.waypoints[index] || {}), address: value };
      return next;
    });
    try {
      const results = await searchPlace(value);
      setSuggestions(prev => ({ ...prev, [index]: results }));
    } catch (e) {
      console.error(e);
    }
  };

  const pickSuggestion = (index, suggestion) => {
    setForm(prev => {
      const next = { ...prev };
      next.waypoints[index] = { address: suggestion.display, coords: { lat: suggestion.lat, lng: suggestion.lng } };
      return next;
    });
    if (mapInstanceRef.current) mapInstanceRef.current.setView([suggestion.lat, suggestion.lng], 12);
    setSuggestions(prev => ({ ...prev, [index]: [] }));
    // add/update marker
    if (mapInstanceRef.current) {
      const icon = L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize: [25, 41], iconAnchor: [12, 41], shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' });
      const m = L.marker([suggestion.lat, suggestion.lng], { icon }).bindPopup(suggestion.display);
      if (markersRef.current[index]) {
        mapInstanceRef.current.removeLayer(markersRef.current[index]);
      }
      m.addTo(mapInstanceRef.current);
      markersRef.current[index] = m;
    }
  };

  const drawRoute = (coords) => {
    if (!mapInstanceRef.current) return;
    if (routeLayerRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    routeLayerRef.current = L.polyline(coords.map(c => [c.lat, c.lng]), { color: 'blue', weight: 4 }).addTo(mapInstanceRef.current);
    const bounds = routeLayerRef.current.getBounds();
    mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
  };

  const computeRoute = async () => {
    if (!form.waypoints || form.waypoints.length < 2) return;
    const coords = form.waypoints.filter(w => w?.coords).map(w => `${w.coords.lng},${w.coords.lat}`);
    if (coords.length < 2) return;
    const backendUrl = `/api/maps/osrm?coords=${encodeURIComponent(coords.join(';'))}`;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=full&geometries=geojson`;
    let data;
    try {
      const res = await fetch(backendUrl);
      if (!res.ok) throw new Error(`Backend proxy ${res.status}`);
      data = await res.json();
    } catch (e) {
      // Fallback via public CORS proxy
      try {
        const corsUrl = `https://corsproxy.io/?${encodeURIComponent(osrmUrl)}`;
        const res2 = await fetch(corsUrl);
        if (!res2.ok) throw new Error(`corsproxy.io ${res2.status}`);
        data = await res2.json();
      } catch (e2) {
        console.error('Route fetch failed', e, e2);
        toast.error('Failed to calculate route');
        return;
      }
    }
    if (data.routes && data.routes[0]) {
      const route = data.routes[0];
      const coords = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
      const distanceKm = +(route.distance / 1000).toFixed(2);
      setForm(prev => ({ ...prev, route: coords, distanceKm }));
      drawRoute(coords);
    } else {
      toast.error('No route found');
    }
  };

  useEffect(() => {
    computeRoute();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(form.waypoints)]);

  const addWaypoint = () => {
    // always append to the end as a new stop (before routing we treat the last as destination after user sets it)
    setForm(prev => ({ ...prev, waypoints: [...(prev.waypoints || []), { address: '', coords: null }] }));
  };

  const removeWaypoint = (index) => {
    setForm(prev => {
      const next = { ...prev };
      next.waypoints = next.waypoints.filter((_, i) => i !== index);
      return next;
    });
  };

  const moveWaypoint = (from, to) => {
    setForm(prev => {
      const next = { ...prev };
      const arr = [...next.waypoints];
      const item = arr.splice(from, 1)[0];
      arr.splice(to, 0, item);
      next.waypoints = arr;
      return next;
    });
  };

  const todayStr = () => new Date().toISOString().split('T')[0];
  const maxDateStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().split('T')[0];
  };

  const computeDaysAndTotal = () => {
    if (!form.startDate || !form.endDate) return;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const ms = end - start;
    if (ms < 0) return; // invalid
    const days = Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
    const total = (form.driverBata || 0) * days + (form.ratePerKm || 0) * (form.distanceKm || 0) + (form.vehicleRent || 0) * days;
    setForm(prev => ({ ...prev, numDays: days, totalAmount: +total.toFixed(2) }));
  };

  useEffect(() => {
    computeDaysAndTotal();
  }, [form.startDate, form.endDate, form.driverBata, form.ratePerKm, form.vehicleRent, form.distanceKm]);

  const refreshAvailability = async () => {
    if (!form.startDate || !form.endDate) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('/api/trips/availability', {
        params: { startDate: form.startDate, endDate: form.endDate },
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnavailable({ vehicles: new Set(res.data.unavailableVehicles || []), drivers: new Set(res.data.unavailableDrivers || []) });
    } catch (e) {
      if (e.response?.status === 404) {
        // availability API not present; skip silently
        return;
      }
      console.error(e);
    }
  };

  useEffect(() => {
    refreshAvailability();
  }, [form.startDate, form.endDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const payload = {
        trip_id: `TRIP-${Date.now()}`,
        startAddress: form.waypoints[0]?.address,
        endAddress: form.waypoints[form.waypoints.length - 1]?.address,
        startCoords: form.waypoints[0]?.coords,
        endCoords: form.waypoints[form.waypoints.length - 1]?.coords,
        route: form.route,
        distanceKm: form.distanceKm,
        startDate: form.startDate,
        endDate: form.endDate,
        vehicleId: form.vehicleId,
        driverId: form.driverId,
        status: 'scheduled',
        driverBata: form.driverBata,
        ratePerKm: form.ratePerKm,
        vehicleRent: form.vehicleRent,
        totalAmount: form.totalAmount,
        numDays: form.numDays
      };
      const res = await axios.post('/api/trips', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Trip created');
      // reset form minimal
      setForm(prev => ({ ...prev, waypoints: [], route: [], distanceKm: 0, vehicleId: '', driverId: '', driverBata: 0, ratePerKm: 0, vehicleRent: 0, totalAmount: 0, numDays: 1 }));
      if (routeLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to create trip';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white shadow rounded-lg p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">Route</label>
              <button type="button" onClick={addWaypoint} className="text-blue-600 hover:text-blue-800 text-sm">Add destination</button>
            </div>
            <div className="space-y-3">
              {form.waypoints.map((w, idx) => (
                <div key={idx} className="relative">
                  <div className="flex items-center gap-2">
                    <input value={w.address || ''} onChange={(e) => handleSearchChange(idx, e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={idx === 0 ? 'Choose starting point...' : (idx === form.waypoints.length - 1 ? 'Choose destination...' : `Stop ${idx}`)} />
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveWaypoint(idx, Math.max(0, idx - 1))} disabled={idx === 0} className="p-2 rounded border disabled:opacity-40" title="Move up">↑</button>
                      <button type="button" onClick={() => moveWaypoint(idx, Math.min(form.waypoints.length - 1, idx + 1))} disabled={idx === form.waypoints.length - 1} className="p-2 rounded border disabled:opacity-40" title="Move down">↓</button>
                      <button type="button" onClick={() => removeWaypoint(idx)} disabled={form.waypoints.length <= 2 && (idx === 0 || idx === form.waypoints.length - 1)} className="p-2 rounded border disabled:opacity-40" title="Remove">✕</button>
                    </div>
                  </div>
                  {Array.isArray(suggestions[idx]) && suggestions[idx].length > 0 && (
                    <div className="border rounded mt-1 bg-white max-h-40 overflow-auto z-10">
                      {suggestions[idx].map((s, sidx) => (
                        <button key={`wg-${idx}-${sidx}`} type="button" onClick={() => pickSuggestion(idx, s)} className="w-full text-left px-3 py-2 hover:bg-gray-100">
                          {s.display}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {form.waypoints.length < 2 && (
                <p className="text-xs text-gray-500">Add at least a start and a destination.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                <input type="date" min={todayStr()} max={maxDateStr()} value={form.startDate} onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                <input type="date" min={form.startDate || todayStr()} max={maxDateStr()} value={form.endDate} onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver bata (per day)</label>
                <input type="number" min="0" value={form.driverBata} onChange={(e) => setForm(prev => ({ ...prev, driverBata: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rate per km</label>
                <input type="number" min="0" value={form.ratePerKm} onChange={(e) => setForm(prev => ({ ...prev, ratePerKm: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle rent (per day)</label>
                <input type="number" min="0" value={form.vehicleRent} onChange={(e) => setForm(prev => ({ ...prev, vehicleRent: Number(e.target.value) }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="0" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
              <select value={form.vehicleId} onChange={(e) => setForm(prev => ({ ...prev, vehicleId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select vehicle</option>
                {vehicles.map(v => (
                  <option key={v._id} value={v._id} disabled={unavailable.vehicles.has(String(v._id))}>
                    {v.registeredNumber} {unavailable.vehicles.has(String(v._id)) ? '(Unavailable)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
              <select value={form.driverId} onChange={(e) => setForm(prev => ({ ...prev, driverId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select driver</option>
                {drivers.map(d => (
                  <option key={d._id || d.id} value={d._id || d.id} disabled={unavailable.drivers.has(String(d._id || d.id))}>
                    {d.name || 'Unnamed Driver'} {unavailable.drivers.has(String(d._id || d.id)) ? '(Unavailable)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-3 flex flex-wrap gap-6">
              <div>Days: <span className="font-medium">{form.numDays}</span></div>
              <div>Distance: <span className="font-medium">{form.distanceKm} km</span> <button type="button" onClick={computeRoute} className="ml-2 text-blue-600 hover:text-blue-800">Recompute</button></div>
              <div>Total: <span className="font-semibold">₹ {form.totalAmount.toLocaleString()}</span></div>
            </div>

            <div className="flex justify-end">
              <button type="submit" disabled={loading || (form.waypoints.filter(w => w?.coords).length < 2) || !form.vehicleId || !form.driverId || !form.startDate || !form.endDate} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm disabled:bg-gray-400">
                {loading ? 'Creating...' : 'Create Trip'}
              </button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white shadow rounded-lg p-2 overflow-hidden">
          <div ref={mapRef} className="w-full h-[480px] rounded-md overflow-hidden" />
        </div>
      </div>
    </div>
  );
};

export default TripsTab;



