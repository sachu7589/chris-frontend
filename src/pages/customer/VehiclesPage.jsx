import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import SendEnquiryModal from '../../components/SendEnquiryModal';

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchFilters, setSearchFilters] = useState({
    search: '',
    vehicleClass: '',
    vehicleType: '',
    minSeatingCapacity: '',
    maxSeatingCapacity: '',
    startDate: '',
    endDate: ''
  });
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);

  // Fetch vehicles
  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
      
      const res = await fetch(`/api/enquiries/vehicles?${queryParams}`);
      if (!res.ok) throw new Error('Failed to load vehicles');
      const data = await res.json();
      setVehicles(data.vehicles || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      toast.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  // Submit enquiry
  const submitEnquiry = async (enquiryData) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/enquiries/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          vehicleId: selectedVehicle._id,
          ...enquiryData
        })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Enquiry submission error:', errorData);
        throw new Error(errorData.message || 'Failed to submit enquiry');
      }
      
      const result = await res.json();
      console.log('Enquiry submitted successfully:', result);
      toast.success('Enquiry submitted successfully');
      setShowEnquiryModal(false);
      setSelectedVehicle(null);
    } catch (error) {
      console.error('Error submitting enquiry:', error);
      toast.error('Failed to submit enquiry');
      throw error; // Re-throw to let the modal handle it
    }
  };

  // Handle search filter changes
  const handleFilterChange = (key, value) => {
    setSearchFilters(prev => ({ ...prev, [key]: value }));
  };

  // Open enquiry modal
  const openEnquiryModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setShowEnquiryModal(true);
  };

  // Load vehicles on component mount
  useEffect(() => {
    fetchVehicles();
  }, []);

  // Refetch vehicles when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchVehicles();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchFilters]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Find Vehicles</h2>
      
      {/* Search and Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={searchFilters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Vehicle number, make, class..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Class</label>
            <select
              value={searchFilters.vehicleClass}
              onChange={(e) => handleFilterChange('vehicleClass', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Classes</option>
              <option value="LMV">LMV</option>
              <option value="HMV">HMV</option>
              <option value="MCWG">MCWG</option>
              <option value="MCC">MCC</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle Type</label>
            <select
              value={searchFilters.vehicleType}
              onChange={(e) => handleFilterChange('vehicleType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Types</option>
              <option value="Logistics">Logistics</option>
              <option value="Passenger">Passenger</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Min Seating</label>
            <input
              type="number"
              value={searchFilters.minSeatingCapacity}
              onChange={(e) => handleFilterChange('minSeatingCapacity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Min capacity"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max Seating</label>
            <input
              type="number"
              value={searchFilters.maxSeatingCapacity}
              onChange={(e) => handleFilterChange('maxSeatingCapacity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Max capacity"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={searchFilters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={searchFilters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              min={searchFilters.startDate || new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
        <div className="mt-4 text-sm text-gray-600">
          <p>💡 <strong>Tip:</strong> Select start and end dates to see only vehicles available for your trip dates.</p>
        </div>
      </div>

      {/* Vehicles List */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">Available Vehicles ({vehicles.length})</h3>
        </div>
        {loading ? (
          <div className="p-6">Loading vehicles...</div>
        ) : vehicles.length === 0 ? (
          <div className="p-6 text-gray-600">No vehicles found matching your criteria.</div>
        ) : (
          <div className="p-4 space-y-4">
            {vehicles.map((vehicle) => (
              <div key={vehicle._id} className="border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {vehicle.vehicleImage?.url && (
                    <img
                      src={vehicle.vehicleImage.url}
                      alt="Vehicle"
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {vehicle.registeredNumber} - {vehicle.makersName}
                    </div>
                    <div className="text-xs text-gray-600">
                      Class: {vehicle.vehicleClass} • Type: {vehicle.vehicleType || 'N/A'} • 
                      Seating: {vehicle.seatingCapacity || 'N/A'}
                    </div>
                            <div className="text-xs text-gray-500">
                              Business: {vehicle.businessId?.name || vehicle.businessId?.email || 'N/A'}
                            </div>
                  </div>
                </div>
                <button
                  onClick={() => openEnquiryModal(vehicle)}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  Send Enquiry
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Enquiry Modal */}
      <SendEnquiryModal
        isOpen={showEnquiryModal}
        onClose={() => {
          setShowEnquiryModal(false);
          setSelectedVehicle(null);
        }}
        vehicle={selectedVehicle}
        onSubmit={submitEnquiry}
      />
    </div>
  );
};

export default VehiclesPage;
