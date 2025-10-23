import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const TripsListPage = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch('/api/trips', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to load trips');
      const data = await res.json();
      
      // Filter out pending_payment trips, only show confirmed/scheduled trips
      const confirmedTrips = (data.trips || []).filter(trip => 
        trip.status !== 'pending_payment'
      );
      
      setTrips(confirmedTrips);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrips(); }, []);

  const deleteTrip = async (id) => {
    if (!confirm('Delete this trip?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/trips/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Trip deleted');
      fetchTrips();
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete trip');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Confirmed Trips ({trips.length})</h2>
        <button onClick={fetchTrips} className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700">Refresh</button>
      </div>

      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-6">Loading...</div>
        ) : trips.length === 0 ? (
          <div className="p-6 text-gray-600">No trips yet.</div>
        ) : (
          <div className="p-4 space-y-3">
            {trips.map(t => (
              <div key={t._id} className="border rounded-md p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm text-gray-900 font-medium">{t.startAddress} → {t.endAddress}</div>
                  <div className="text-xs text-gray-600">{new Date(t.startDate).toLocaleDateString()} - {new Date(t.endDate).toLocaleDateString()} • {t.numDays || 1} day(s)</div>
                  <div className="text-xs text-gray-600">Distance: {t.distanceKm} km • Total: ₹ {Number(t.totalAmount || 0).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Vehicle: {t.vehicleId?.registeredNumber || t.vehicleId} • Driver: {t.driverId?.name || t.driverId}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${t.status === 'completed' ? 'bg-green-100 text-green-800' : t.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{t.status}</span>
                  <button onClick={() => deleteTrip(t._id)} className="text-red-600 hover:text-red-800 text-sm">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TripsListPage;



