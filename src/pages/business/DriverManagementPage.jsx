import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const DriverManagementPage = () => {
  const [hiredDrivers, setHiredDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDriver, setExpandedDriver] = useState(null);
  const [driverDetails, setDriverDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  useEffect(() => {
    fetchHiredDrivers();
  }, []);

  const fetchHiredDrivers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch('/api/drivers/hired', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setHiredDrivers(Array.isArray(data.drivers) ? data.drivers : []);
      } else {
        console.error('Failed to fetch hired drivers', res.status);
        toast.error('Failed to fetch hired drivers');
      }
    } catch (e) {
      console.error('Error fetching hired drivers', e);
      toast.error('Error fetching hired drivers');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverDetails = async (driverId) => {
    try {
      setLoadingDetails(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      const res = await fetch(`/api/drivers/${driverId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (res.ok) {
        const data = await res.json();
        setDriverDetails(prev => ({
          ...prev,
          [driverId]: data.driver
        }));
      } else {
        console.error('Failed to fetch driver details', res.status);
        toast.error('Failed to fetch driver details');
      }
    } catch (e) {
      console.error('Error fetching driver details', e);
      toast.error('Error fetching driver details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const toggleDriverDetails = (driverId) => {
    if (expandedDriver === driverId) {
      setExpandedDriver(null);
    } else {
      setExpandedDriver(driverId);
      // Fetch details if not already cached
      if (!driverDetails[driverId]) {
        fetchDriverDetails(driverId);
      }
    }
  };

  const handleDriverAction = (driver, action) => {
    setSelectedDriver(driver);
    setActionType(action);
    setActionReason('');
    setRating(0);
    setReview('');
    setShowActionModal(true);
  };

  const confirmDriverAction = async () => {
    if (!selectedDriver || !actionType) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      let endpoint = '';
      let body = {};

      switch (actionType) {
        case 'on-leave':
          endpoint = `/api/drivers/${selectedDriver._id || selectedDriver.id}/status`;
          body = { 
            status: 'on-leave',
            reason: actionReason 
          };
          break;
        case 'suspend':
          endpoint = `/api/drivers/${selectedDriver._id || selectedDriver.id}/status`;
          body = { 
            status: 'suspended',
            reason: actionReason 
          };
          break;
        case 'remove':
          endpoint = `/api/drivers/${selectedDriver._id || selectedDriver.id}/remove`;
          body = { 
            reason: actionReason,
            rating: rating,
            review: review
          };
          break;
        default:
          return;
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const actionMessages = {
          'on-leave': 'Driver marked as on leave',
          'suspend': 'Driver suspended',
          'remove': 'Driver removed and made available for hiring'
        };
        toast.success(actionMessages[actionType]);
        setShowActionModal(false);
        fetchHiredDrivers(); // Refresh the list
      } else {
        const error = await res.json();
        toast.error(error.message || `Failed to ${actionType} driver`);
      }
    } catch (e) {
      console.error(`Error ${actionType} driver:`, e);
      toast.error(`Failed to ${actionType} driver`);
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'active': { color: 'bg-green-100 text-green-800', text: 'Active' },
      'on-leave': { color: 'bg-yellow-100 text-yellow-800', text: 'On Leave' },
      'suspended': { color: 'bg-red-100 text-red-800', text: 'Suspended' },
      'hired': { color: 'bg-blue-100 text-blue-800', text: 'Hired' }
    };
    
    const config = statusConfig[status] || statusConfig['hired'];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const filterDrivers = (driverList) => {
    return driverList.filter(driver => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        (driver.name && driver.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (driver.dlNumber && driver.dlNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      // Status filter
      const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  };

  const filteredDrivers = filterDrivers(hiredDrivers);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Driver Management</h2>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm"
          onClick={fetchHiredDrivers}
        >
          Refresh
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-6">
          {/* Search Bar */}
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search drivers by name or DL number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="on-leave">On Leave</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </div>
      </div>

      {/* Drivers List */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6">
          {loading ? (
            <div className="p-6 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading drivers...</p>
            </div>
          ) : hiredDrivers.length === 0 ? (
            <div className="text-center text-gray-600">
              <p>No hired drivers found.</p>
              <p className="text-sm mt-2">Hire drivers from the Hire page to manage them here.</p>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <div className="text-center text-gray-600">
              <p>No drivers match your search criteria.</p>
              <p className="text-sm mt-2">Try adjusting your search terms or filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDrivers.map(driver => (
                <div key={driver._id || driver.id} className="border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      {/* Left Column - Icon and Name */}
                      <div className="flex items-center space-x-4">
                        {driver.profileImage ? (
                          <img 
                            src={driver.profileImage} 
                            alt={driver.name || 'Driver'} 
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                            {driver.name ? driver.name.charAt(0).toUpperCase() : 'D'}
                          </div>
                        )}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">{driver.name || 'Unnamed Driver'}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            {getStatusBadge(driver.status)}
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Column - DL, Vehicle Class, and Actions */}
                      <div className="flex items-center space-x-6">
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-600">DL: {driver.dlNumber || 'N/A'}</span>
                          <span className="text-sm text-gray-600">
                            {Array.isArray(driver.vehicleClass) ? driver.vehicleClass.join(', ') : (driver.vehicleClass || 'N/A')}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          <button
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                            onClick={() => toggleDriverDetails(driver._id || driver.id)}
                          >
                            {expandedDriver === (driver._id || driver.id) ? 'Hide Details' : 'View Details'}
                          </button>
                          <div className="flex space-x-1">
                            <button
                              className="bg-yellow-600 hover:bg-yellow-700 text-white px-2 py-1 rounded text-xs"
                              onClick={() => handleDriverAction(driver, 'on-leave')}
                              disabled={driver.status === 'on-leave'}
                            >
                              On Leave
                            </button>
                            <button
                              className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs"
                              onClick={() => handleDriverAction(driver, 'suspend')}
                              disabled={driver.status === 'suspended'}
                            >
                              Suspend
                            </button>
                            <button
                              className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs"
                              onClick={() => handleDriverAction(driver, 'remove')}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Expanded Driver Details */}
                  {expandedDriver === (driver._id || driver.id) && (
                    <div className="border-t bg-gray-50 p-5">
                      {loadingDetails ? (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-sm text-gray-600">Loading details...</span>
                        </div>
                      ) : driverDetails[driver._id || driver.id] ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                              <p className="text-sm text-gray-900">{driverDetails[driver._id || driver.id].name || 'N/A'}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">DL Number</label>
                              <p className="text-sm text-gray-900">{driverDetails[driver._id || driver.id].dlNumber || 'N/A'}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                              <p className="text-sm text-gray-900">
                                {driverDetails[driver._id || driver.id].dateOfBirth ? new Date(driverDetails[driver._id || driver.id].dateOfBirth).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                              <p className="text-sm text-gray-900">{driverDetails[driver._id || driver.id].bloodGroup || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                              <p className="text-sm text-gray-900">{driverDetails[driver._id || driver.id].permanentAddress || 'N/A'}</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Classes</label>
                              <p className="text-sm text-gray-900">
                                {Array.isArray(driverDetails[driver._id || driver.id].vehicleClass) 
                                  ? driverDetails[driver._id || driver.id].vehicleClass.join(', ') 
                                  : (driverDetails[driver._id || driver.id].vehicleClass || 'N/A')
                                }
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">DL Validity</label>
                              <p className="text-sm text-gray-900">
                                {driverDetails[driver._id || driver.id].dlValidity ? new Date(driverDetails[driver._id || driver.id].dlValidity).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                              {getStatusBadge(driverDetails[driver._id || driver.id].status)}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-4">
                          <p>Failed to load driver details</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {showActionModal && selectedDriver && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-24 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {actionType === 'on-leave' && 'Mark Driver as On Leave'}
                  {actionType === 'suspend' && 'Suspend Driver'}
                  {actionType === 'remove' && 'Remove Driver'}
                </h3>
                <button onClick={() => setShowActionModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm text-gray-700">
                    <strong>Driver:</strong> {selectedDriver.name || 'Unnamed Driver'}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>DL Number:</strong> {selectedDriver.dlNumber || 'N/A'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                  <textarea 
                    rows={3} 
                    value={actionReason} 
                    onChange={(e) => setActionReason(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="Enter reason for this action..."
                    required
                  />
                </div>

                {actionType === 'remove' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5 stars)</label>
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setRating(star)}
                            className={`text-2xl ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Review</label>
                      <textarea 
                        rows={3} 
                        value={review} 
                        onChange={(e) => setReview(e.target.value)} 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        placeholder="Write a review about this driver..."
                      />
                    </div>
                  </>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                  <p className="text-sm text-yellow-800">
                    {actionType === 'on-leave' && 'This will mark the driver as on leave. They will not be available for new assignments.'}
                    {actionType === 'suspend' && 'This will suspend the driver. They will not be available for any assignments until unsuspended.'}
                    {actionType === 'remove' && 'This will remove the driver from your team and make them available for hiring by other businesses.'}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  onClick={() => setShowActionModal(false)} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDriverAction}
                  disabled={!actionReason.trim()}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    actionType === 'on-leave' ? 'bg-yellow-600 hover:bg-yellow-700' :
                    actionType === 'suspend' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-gray-600 hover:bg-gray-700'
                  } disabled:bg-gray-400`}
                >
                  {actionType === 'on-leave' && 'Mark as On Leave'}
                  {actionType === 'suspend' && 'Suspend Driver'}
                  {actionType === 'remove' && 'Remove Driver'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverManagementPage;

