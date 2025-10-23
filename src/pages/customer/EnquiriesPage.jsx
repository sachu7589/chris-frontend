import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import PaymentModal from '../../components/PaymentModal';

const EnquiriesPage = () => {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const navigate = useNavigate();

  // Fetch customer enquiries
  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      console.log('fetchEnquiries - Starting fetch with token:', token ? 'Present' : 'Missing');
      
      if (!token) {
        console.log('fetchEnquiries - No token, redirecting to login');
        toast.error('Please log in to view your enquiries');
        navigate('/login');
        return;
      }
      
      console.log('fetchEnquiries - Making request to /api/enquiries/customer');
      const res = await fetch('/api/enquiries/customer', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('fetchEnquiries - Response status:', res.status);
      
      if (!res.ok) {
        const errorData = await res.json();
        console.log('fetchEnquiries - Error response:', errorData);
        if (res.status === 401) {
          console.log('fetchEnquiries - 401 error, redirecting to login');
          toast.error('Session expired. Please log in again.');
          navigate('/login');
          return;
        }
        throw new Error(errorData.message || 'Failed to load enquiries');
      }
      
      const data = await res.json();
      console.log('fetchEnquiries - Success response:', data);
      setEnquiries(data.enquiries || []);
    } catch (error) {
      console.error('fetchEnquiries - Error:', error);
      toast.error(error.message || 'Failed to load enquiries');
    } finally {
      setLoading(false);
    }
  };

  // Open payment modal
  const openPaymentModal = (enquiry) => {
    setSelectedEnquiry(enquiry);
    setShowPaymentModal(true);
  };

  // Handle payment completion
  const handlePaymentComplete = (result) => {
    console.log('Payment completed:', result);
    fetchEnquiries(); // Refresh enquiries
  };

  // Load enquiries on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    console.log('EnquiriesPage - Token:', token ? 'Present' : 'Missing');
    console.log('EnquiriesPage - User:', user ? JSON.parse(user) : 'Missing');
    
    if (!token || !user) {
      console.log('EnquiriesPage - No auth data, redirecting to login');
      toast.error('Please log in to view your enquiries');
      navigate('/login');
      return;
    }
    
    console.log('EnquiriesPage - Auth data present, fetching enquiries');
    fetchEnquiries();
  }, [navigate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Enquiries</h2>
        <button 
          onClick={fetchEnquiries} 
          className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Enquiry History</h3>
        </div>
        {loading ? (
          <div className="p-6">Loading enquiries...</div>
        ) : enquiries.length === 0 ? (
          <div className="p-6 text-gray-600">No enquiries yet.</div>
        ) : (
          <div className="p-4 space-y-4">
            {enquiries.map((enquiry) => (
              <div key={enquiry._id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-gray-900">
                    {enquiry.vehicleId?.registeredNumber} - {enquiry.vehicleId?.makersName}
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    enquiry.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                    enquiry.status === 'trip_created' ? 'bg-blue-100 text-blue-800' :
                    enquiry.status === 'responded' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {enquiry.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Route: {enquiry.startingPoint} → {enquiry.destination}
                </div>
                <div className="text-sm text-gray-600">
                  Dates: {new Date(enquiry.startDate).toLocaleDateString()} - {new Date(enquiry.endDate).toLocaleDateString()}
                </div>
                {enquiry.businessResponse?.message && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                    <strong>Business Response:</strong> {enquiry.businessResponse.message}
                  </div>
                )}
                {enquiry.status === 'trip_created' && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                    <strong>Trip Created!</strong> Total: ₹{enquiry.totalAmount?.toLocaleString()} • 
                    Advance Required: ₹{enquiry.advanceAmount?.toLocaleString()}
                    <div className="mt-2 space-x-2">
                      <button
                        onClick={() => openPaymentModal(enquiry)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Pay Now
                      </button>
                      <span className="text-xs text-gray-600">
                        Choose to pay advance or full amount
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedEnquiry(null);
        }}
        enquiry={selectedEnquiry}
        onSubmit={handlePaymentComplete}
      />
    </div>
  );
};

export default EnquiriesPage;
