import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const PaymentModal = ({ isOpen, onClose, trip, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => setRazorpayLoaded(true);
    script.onerror = () => {
      toast.error('Failed to load Razorpay');
      setRazorpayLoaded(false);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      toast.error('Razorpay is still loading, please wait');
      return;
    }

    if (!trip) {
      toast.error('No trip selected');
      return;
    }

    try {
      setLoading(true);
      
      // Create payment order
      const token = localStorage.getItem('token');
      console.log('Creating payment order for trip:', trip._id);
      const response = await fetch('/api/trips/create-payment-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tripId: trip._id
        })
      });
      
      console.log('Payment order response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Failed to create payment order';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          const text = await response.text();
          console.error('Non-JSON response:', text);
          errorMessage = `Server error: ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const { order, amount } = await response.json();

      // Configure Razorpay options
      const options = {
        key: 'rzp_test_RVL3dTzHqSRYTV',
        amount: order.amount,
        currency: order.currency,
        name: 'MobiTrak',
        description: 'Full Payment for Trip',
        order_id: order.id,
        handler: async (response) => {
          try {
            // Verify payment
            const verifyResponse = await fetch('/api/trips/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                tripId: trip._id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });

            if (!verifyResponse.ok) {
              const errorData = await verifyResponse.json();
              throw new Error(errorData.message || 'Payment verification failed');
            }

            const result = await verifyResponse.json();
            toast.success(result.message);
            onSubmit && onSubmit(result);
            onClose();
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed: ' + error.message);
          }
        },
        prefill: {
          name: trip.customerName || '',
          email: trip.customerEmail || '',
        },
        theme: {
          color: '#3B82F6'
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
      
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Payment failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !trip) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Pay Now</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {/* Trip Details */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Trip Details</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <div>Route: {trip.startAddress} → {trip.endAddress}</div>
              <div>Dates: {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}</div>
              <div>Vehicle: {trip.vehicleId?.registeredNumber} - {trip.vehicleId?.makersName}</div>
            </div>
          </div>

          {/* Payment Amount */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Payment Summary</h4>
            <div className="text-sm">
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-medium text-lg">₹{trip.totalAmount?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payment Button */}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePayment}
              disabled={loading || !razorpayLoaded}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : 
               !razorpayLoaded ? 'Loading...' : 
               `Pay ₹${trip.totalAmount?.toLocaleString()}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
