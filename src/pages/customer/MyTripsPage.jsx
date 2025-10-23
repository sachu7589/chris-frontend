import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PaymentModal from '../../components/PaymentModal';

const MyTripsPage = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const navigate = useNavigate();

  // Fetch customer trips
  const fetchTrips = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      console.log('fetchTrips - Starting fetch with token:', token ? 'Present' : 'Missing');
      
      if (!token) {
        console.log('fetchTrips - No token, redirecting to login');
        toast.error('Please log in to view your trips');
        navigate('/login');
        return;
      }
      
      console.log('fetchTrips - Making request to /api/trips/customer');
      const res = await fetch('/api/trips/customer', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('fetchTrips - Response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.log('fetchTrips - Error response:', errorData);
        if (res.status === 401) {
          console.log('fetchTrips - 401 error, redirecting to login');
          toast.error('Session expired. Please log in again.');
          navigate('/login');
          return;
        }
        throw new Error(errorData.message || 'Failed to load trips');
      }
      
      const data = await res.json();
      console.log('fetchTrips - Success response:', data);
      setTrips(data.trips || []);
    } catch (error) {
      console.error('fetchTrips - Error:', error);
      toast.error(error.message || 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  // Load trips on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    console.log('MyTripsPage - Token:', token ? 'Present' : 'Missing');
    console.log('MyTripsPage - User:', user ? JSON.parse(user) : 'Missing');
    
    if (!token || !user) {
      console.log('MyTripsPage - No auth data, redirecting to login');
      toast.error('Please log in to view your trips');
      navigate('/login');
      return;
    }
    
    console.log('MyTripsPage - Auth data present, fetching trips');
    fetchTrips();
  }, [navigate]);

  // Handle payment
  const handlePayment = (trip) => {
    setSelectedTrip(trip);
    setPaymentModalOpen(true);
  };

  // Handle payment success
  const handlePaymentSuccess = (result) => {
    toast.success('Payment completed successfully!');
    fetchTrips(); // Refresh trips list
    setPaymentModalOpen(false);
    setSelectedTrip(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Trips</h2>
        <button 
          onClick={fetchTrips} 
          className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Trip History</h3>
        </div>
        {loading ? (
          <div className="p-6">Loading trips...</div>
        ) : trips.length === 0 ? (
          <div className="p-6 text-gray-600">No trips yet.</div>
        ) : (
          <div className="p-4 space-y-4">
            {trips.map((trip) => (
              <div key={trip._id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900">
                    {trip.startAddress} → {trip.endAddress}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    trip.status === 'completed' ? 'bg-green-100 text-green-800' :
                    trip.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    trip.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                    trip.status === 'pending_payment' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {trip.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Dates: {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()} • {trip.numDays || 1} day(s)
                </div>
                <div className="text-sm text-gray-600">
                  Distance: {trip.distanceKm} km • Total: ₹{Number(trip.totalAmount || 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">
                  Vehicle: {trip.vehicleId?.registeredNumber || trip.vehicleId} • Driver: {trip.driverId?.name || trip.driverId}
                </div>
                {trip.paymentStatus && (
                  <div className="text-sm text-gray-500">
                    Payment Status: {trip.paymentStatus === 'paid' ? 'Fully Paid' : 
                                   trip.paymentStatus === 'advance_paid' ? 'Advance Paid' : 'Pending Payment'}
                  </div>
                )}
                {trip.status === 'pending_payment' && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-sm">
                    <strong>Payment Required:</strong> Please complete payment to confirm your trip.
                    <button
                      onClick={() => handlePayment(trip)}
                      className="ml-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                      Pay Now
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedTrip(null);
        }}
        trip={selectedTrip}
        onSubmit={handlePaymentSuccess}
      />
    </div>
  );
};

export default MyTripsPage;
