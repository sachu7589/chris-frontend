import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const PendingTripsPage = () => {
  const [pendingTrips, setPendingTrips] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch pending trips
  const fetchPendingTrips = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        toast.error('Please log in to view pending trips');
        return;
      }
      
      const res = await fetch('/api/enquiries/business/pending-trips', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.message || 'Failed to load pending trips');
      }
      
      const data = await res.json();
      setPendingTrips(data.enquiries || []);
    } catch (error) {
      console.error('Error fetching pending trips:', error);
      toast.error('Failed to load pending trips: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Load pending trips on component mount
  useEffect(() => {
    fetchPendingTrips();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_payment': return 'bg-yellow-100 text-yellow-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Pending Trip Confirmations</h2>
        <button 
          onClick={fetchPendingTrips} 
          className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">
            Trips Awaiting Customer Payment ({pendingTrips.length})
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            These trips have been created and are waiting for customer payment confirmation.
          </p>
        </div>
        
        {loading ? (
          <div className="p-6">Loading pending trips...</div>
        ) : pendingTrips.length === 0 ? (
          <div className="p-6 text-gray-600">No pending trips at the moment.</div>
        ) : (
          <div className="p-4 space-y-4">
            {pendingTrips.map((trip) => (
              <div key={trip.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="text-sm font-medium text-gray-900">
                        {trip.vehicle.number} - {trip.vehicle.name}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor('pending_payment')}`}>
                        Awaiting Payment
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                      <div>
                        <strong>Customer:</strong> {trip.customer.name}
                      </div>
                      <div>
                        <strong>Vehicle Class:</strong> {trip.vehicle.class}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>Route:</strong> {trip.route.from} → {trip.route.to}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                      <div>
                        <strong>Dates:</strong> {new Date(trip.dates.start).toLocaleDateString()} - {new Date(trip.dates.end).toLocaleDateString()}
                      </div>
                      <div>
                        <strong>Trip ID:</strong> {trip.tripId}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <div className="text-sm text-yellow-800">
                        <strong>Total Amount:</strong> ₹{trip.amount.total?.toLocaleString()}
                      </div>
                      <div className="text-xs text-yellow-600">
                        <strong>Advance Required:</strong> ₹{trip.amount.advance?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingTripsPage;

