import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import toast from 'react-hot-toast';

const SendEnquiryModal = ({ isOpen, onClose, vehicle, onSubmit }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerRef = useRef(null);
  const markersRef = useRef([]);
  
  const [form, setForm] = useState({
    waypoints: [{ address: '', coords: null }, { address: '', coords: null }], // Start and destination
    startDate: '',
    endDate: '',
    message: '',
    route: [],
    distanceKm: 0
  });
  
  const [suggestions, setSuggestions] = useState({});
  const [loading, setLoading] = useState(false);

  // Initialize map when modal opens
  useEffect(() => {
    if (isOpen && !mapInstanceRef.current && mapRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        preferCanvas: true
      }).setView([20.5937, 78.9629], 5);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(mapInstanceRef.current);
    }
  }, [isOpen]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setForm({
        waypoints: [{ address: '', coords: null }, { address: '', coords: null }],
        startDate: '',
        endDate: '',
        message: '',
        route: [],
        distanceKm: 0
      });
      setSuggestions({});
    } else {
      // Clean up map layers when modal closes
      if (routeLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      markersRef.current.forEach(marker => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.removeLayer(marker);
        }
      });
      markersRef.current = [];
    }
  }, [isOpen]);

  const searchPlace = async (query) => {
    if (!query || query.length < 3) return [];
    
    try {
      // Use backend endpoint to avoid CORS issues
      const url = `/api/maps/search-places?q=${encodeURIComponent(query)}&limit=5&countrycodes=IN`;
      const res = await fetch(url, { 
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        } 
      });
      
      if (!res.ok) {
        console.error('Search service error:', res.status, res.statusText);
        // Try fallback with direct Nominatim call (may fail due to CORS but worth trying)
        try {
          const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=IN`;
          const fallbackRes = await fetch(fallbackUrl, {
            headers: {
              'User-Agent': 'Mobitrak/1.0',
              'Accept-Language': 'en'
            }
          });
          
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json();
            return fallbackData.map(item => ({
              display: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon)
            }));
          }
        } catch (fallbackError) {
          console.error('Fallback search also failed:', fallbackError);
        }
        
        throw new Error('Search service unavailable');
      }
      
      const data = await res.json();
      
      return data.map(item => ({
        display: item.display,
        lat: item.lat,
        lng: item.lng
      }));
    } catch (error) {
      console.error('Search error:', error);
      // Return empty array on error to prevent UI issues
      return [];
    }
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
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const pickSuggestion = (index, suggestion) => {
    setForm(prev => {
      const next = { ...prev };
      next.waypoints[index] = { address: suggestion.display, coords: { lat: suggestion.lat, lng: suggestion.lng } };
      return next;
    });
    
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([suggestion.lat, suggestion.lng], 12);
    }
    
    setSuggestions(prev => ({ ...prev, [index]: [] }));
    
    // Add/update marker
    if (mapInstanceRef.current) {
      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
      });
      
      const marker = L.marker([suggestion.lat, suggestion.lng], { icon })
        .bindPopup(suggestion.display);
      
      if (markersRef.current[index]) {
        mapInstanceRef.current.removeLayer(markersRef.current[index]);
      }
      
      marker.addTo(mapInstanceRef.current);
      markersRef.current[index] = marker;
    }
  };

  const addWaypoint = () => {
    setForm(prev => ({ 
      ...prev, 
      waypoints: [...(prev.waypoints || []), { address: '', coords: null }] 
    }));
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

  const drawRoute = (coords) => {
    if (!mapInstanceRef.current) return;
    
    if (routeLayerRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }
    
    routeLayerRef.current = L.polyline(
      coords.map(c => [c.lat, c.lng]), 
      { color: 'blue', weight: 4 }
    ).addTo(mapInstanceRef.current);
    
    const bounds = routeLayerRef.current.getBounds();
    mapInstanceRef.current.fitBounds(bounds, { padding: [20, 20] });
  };

  const computeRoute = async () => {
    if (!form.waypoints || form.waypoints.length < 2) return;
    const coords = form.waypoints.filter(w => w?.coords).map(w => `${w.coords.lng},${w.coords.lat}`);
    if (coords.length < 2) return;
    
    try {
      // Try backend proxy first
      const backendUrl = `/api/maps/osrm?coords=${encodeURIComponent(coords.join(';'))}`;
      const res = await fetch(backendUrl);
      
      if (res.ok) {
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          const routeCoords = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
          const distanceKm = +(route.distance / 1000).toFixed(2);
          
          setForm(prev => ({ ...prev, route: routeCoords, distanceKm }));
          drawRoute(routeCoords);
        }
      } else {
        throw new Error('Backend route failed');
      }
    } catch (error) {
      // Fallback to direct OSRM
      try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coords.join(';')}?overview=full&geometries=geojson`;
        const corsUrl = `https://corsproxy.io/?${encodeURIComponent(osrmUrl)}`;
        const res = await fetch(corsUrl);
        
        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            const route = data.routes[0];
            const routeCoords = route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
            const distanceKm = +(route.distance / 1000).toFixed(2);
            
            setForm(prev => ({ ...prev, route: routeCoords, distanceKm }));
            drawRoute(routeCoords);
          }
        }
      } catch (fallbackError) {
        console.error('Route calculation failed:', fallbackError);
        toast.error('Failed to calculate route');
      }
    }
  };

  // Auto-compute route when coordinates are available
  useEffect(() => {
    computeRoute();
  }, [JSON.stringify(form.waypoints)]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.waypoints[0]?.address || !form.waypoints[1]?.address || !form.startDate || !form.endDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (!form.waypoints[0]?.coords || !form.waypoints[1]?.coords) {
      toast.error('Please select valid locations from the suggestions');
      return;
    }
    
    // Validate dates
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (start < today) {
      toast.error('Start date cannot be in the past');
      return;
    }
    
    // Allow same date for short distances (below 350km)
    if (end < start) {
      toast.error('End date cannot be before start date');
      return;
    }
    
    // For distances 350km or more, end date must be after start date
    if (form.distanceKm >= 350 && end.getTime() === start.getTime()) {
      toast.error('For distances 350km or more, end date must be after start date');
      return;
    }
    
    // For same day trips, ensure distance is calculated
    if (end.getTime() === start.getTime() && form.distanceKm === 0) {
      toast.error('Please calculate the route first to determine if same-day trip is allowed');
      return;
    }
    
    try {
      setLoading(true);
      
      const enquiryData = {
        vehicleId: vehicle._id,
        startingPoint: form.waypoints[0].address,
        destination: form.waypoints[form.waypoints.length - 1].address,
        startDate: form.startDate,
        endDate: form.endDate,
        message: form.message,
        startCoords: form.waypoints[0].coords,
        endCoords: form.waypoints[form.waypoints.length - 1].coords,
        route: form.route,
        distanceKm: form.distanceKm
      };
      
      await onSubmit(enquiryData);
      onClose();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('Failed to submit enquiry');
    } finally {
      setLoading(false);
    }
  };

  const todayStr = () => new Date().toISOString().split('T')[0];
  const maxDateStr = () => {
    const d = new Date();
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().split('T')[0];
  };

  // Dynamic min date for end date based on distance
  const getEndDateMin = () => {
    if (form.distanceKm >= 350) {
      return form.startDate || todayStr();
    }
    return todayStr();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Send Enquiry</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Vehicle Information */}
        {vehicle && (
          <div className="bg-gray-50 p-4 border-b">
            <h3 className="font-medium text-gray-900 mb-2">Vehicle Information</h3>
            <div className="text-sm text-gray-600">
              <div className="font-medium">{vehicle.registeredNumber} - {vehicle.makersName}</div>
              <div>{vehicle.vehicleClass} • {vehicle.vehicleType} • Seating: {vehicle.seatingCapacity}</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 flex-1 overflow-hidden">
          {/* Form Section */}
          <div className="space-y-4 overflow-y-auto">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Route</label>
                  <button 
                    type="button" 
                    onClick={addWaypoint} 
                    className="text-yellow-600 hover:text-yellow-800 text-sm"
                  >
                    Add destination
                  </button>
                </div>
                <div className="space-y-3">
                  {form.waypoints.map((w, idx) => (
                    <div key={idx} className="relative">
                      <div className="flex items-center gap-2">
                        <input 
                          value={w.address || ''} 
                          onChange={(e) => handleSearchChange(idx, e.target.value)} 
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500" 
                          placeholder={idx === 0 ? 'Choose starting point...' : (idx === form.waypoints.length - 1 ? 'Choose destination...' : `Stop ${idx}`)} 
                        />
                        <div className="flex items-center gap-1">
                          <button 
                            type="button" 
                            onClick={() => moveWaypoint(idx, Math.max(0, idx - 1))} 
                            disabled={idx === 0} 
                            className="p-2 rounded border disabled:opacity-40" 
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button 
                            type="button" 
                            onClick={() => moveWaypoint(idx, Math.min(form.waypoints.length - 1, idx + 1))} 
                            disabled={idx === form.waypoints.length - 1} 
                            className="p-2 rounded border disabled:opacity-40" 
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button 
                            type="button" 
                            onClick={() => removeWaypoint(idx)} 
                            disabled={form.waypoints.length <= 2 && (idx === 0 || idx === form.waypoints.length - 1)} 
                            className="p-2 rounded border disabled:opacity-40" 
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {Array.isArray(suggestions[idx]) && suggestions[idx].length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-auto">
                          {suggestions[idx].map((s, sidx) => (
                            <button 
                              key={`wg-${idx}-${sidx}`} 
                              type="button" 
                              onClick={() => pickSuggestion(idx, s)} 
                              className="w-full text-left px-3 py-2 hover:bg-yellow-50 hover:text-yellow-800"
                            >
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    min={todayStr()}
                    max={maxDateStr()}
                    value={form.startDate}
                    onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    min={getEndDateMin()}
                    max={maxDateStr()}
                    value={form.endDate}
                    onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message (Optional)
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Any additional requirements or questions..."
                  rows={3}
                  maxLength={500}
                />
                <div className="text-xs text-gray-500 mt-1">
                  {form.message.length}/500 characters
                </div>
              </div>

              {/* Route Information */}
              {form.distanceKm > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <div className="text-sm text-yellow-800">
                    <div className="font-medium">Route Information</div>
                    <div>Distance: {form.distanceKm} km</div>
                    <div>Route: {form.waypoints[0]?.address} → {form.waypoints[form.waypoints.length - 1]?.address}</div>
                    {form.distanceKm < 350 && (
                      <div className="text-xs mt-1 text-yellow-600">
                        * Same day trips allowed for distances under 350km
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !form.waypoints[0]?.address || !form.waypoints[1]?.address || !form.startDate || !form.endDate || !form.waypoints[0]?.coords || !form.waypoints[1]?.coords}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400"
                >
                  {loading ? 'Sending...' : 'Send Enquiry'}
                </button>
              </div>
            </form>
          </div>

          {/* Map Section */}
          <div className="bg-gray-100 rounded-lg overflow-hidden h-full">
            <div ref={mapRef} className="w-full h-full" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SendEnquiryModal;
