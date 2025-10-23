import React, { useState } from 'react';
import toast from 'react-hot-toast';

const DriversPage = ({ 
  activeSubTab, 
  setActiveSubTab,
  drivers, 
  hiredDrivers, 
  pendingOffers,
  driversLoading, 
  hiredDriversLoading, 
  pendingOffersLoading,
  fetchAvailableDrivers, 
  fetchHiredDrivers,
  fetchPendingOffers,
  selectedDriver,
  showDriverDetails,
  setSelectedDriver,
  setShowDriverDetails,
  offerForm,
  setOfferForm,
  showOfferModal,
  setShowOfferModal
}) => {
  const [expandedDriver, setExpandedDriver] = useState(null);
  const [driverDetails, setDriverDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleClassFilters, setVehicleClassFilters] = useState({
    HMV: false,
    LMV: false,
    MCWG: false,
    MCWOG: false
  });

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

  // Filter drivers based on search term and vehicle class
  const filterDrivers = (driverList) => {
    return driverList.filter(driver => {
      // Search filter
      const matchesSearch = searchTerm === '' || 
        (driver.name && driver.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (driver.dlNumber && driver.dlNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      // Vehicle class filter
      const matchesVehicleClass = () => {
        const activeFilters = Object.entries(vehicleClassFilters).filter(([_, isActive]) => isActive);
        if (activeFilters.length === 0) return true; // No filters selected, show all
        
        const driverVehicleClass = Array.isArray(driver.vehicleClass) ? driver.vehicleClass : [driver.vehicleClass];
        return activeFilters.some(([vehicleClass, _]) => 
          driverVehicleClass.some(dvc => dvc === vehicleClass)
        );
      };

      return matchesSearch && matchesVehicleClass();
    });
  };

  const handleVehicleClassFilter = (vehicleClass) => {
    setVehicleClassFilters(prev => ({
      ...prev,
      [vehicleClass]: !prev[vehicleClass]
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setVehicleClassFilters({
      HMV: false,
      LMV: false,
      MCWG: false,
      MCWOG: false
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Hire Drivers</h2>
        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm"
          onClick={() => { fetchAvailableDrivers(); fetchHiredDrivers(); fetchPendingOffers(); }}
        >
          Refresh
        </button>
      </div>

      {/* Drivers Sub Navigation */}
      <div className="bg-white shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveSubTab(prev => ({ ...prev, drivers: 'available' }))}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab.drivers === 'available'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Available Drivers
            </button>
            <button
              onClick={() => setActiveSubTab(prev => ({ ...prev, drivers: 'pending' }))}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab.drivers === 'pending'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Offers
            </button>
            <button
              onClick={() => setActiveSubTab(prev => ({ ...prev, drivers: 'hired' }))}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeSubTab.drivers === 'hired'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Hired Drivers
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Search and Filter Section */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
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
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                  />
                </div>
              </div>

              {/* Vehicle Class Filters */}
              <div className="flex flex-wrap items-center space-x-4">
                <span className="text-sm font-medium text-gray-700">Vehicle Class:</span>
                {['HMV', 'LMV', 'MCWG', 'MCWOG'].map(vehicleClass => (
                  <label key={vehicleClass} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={vehicleClassFilters[vehicleClass]}
                      onChange={() => handleVehicleClassFilter(vehicleClass)}
                      className="h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{vehicleClass}</span>
                  </label>
                ))}
              </div>

              {/* Clear Filters Button */}
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {activeSubTab.drivers === 'available' && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Available Drivers</h3>
              <div className="bg-white">
                {driversLoading ? (
                  <div className="p-6 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading drivers...</p>
                  </div>
                ) : drivers.length === 0 ? (
                  <div className="text-center text-gray-600">
                    <p>No available drivers found.</p>
                    <p className="text-sm mt-2">All drivers may have pending offers or be hired by other businesses.</p>
                  </div>
                ) : (() => {
                  const filteredDrivers = filterDrivers(drivers);
                  return filteredDrivers.length === 0 ? (
                    <div className="text-center text-gray-600">
                      <p>No drivers match your search criteria.</p>
                      <p className="text-sm mt-2">Try adjusting your search terms or filters.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredDrivers.map(d => (
                      <div key={d._id || d.id} className="border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                        <div className="p-5">
                          <div className="flex items-center justify-between">
                            {/* Left Column - Icon and Name */}
                            <div className="flex items-center space-x-4">
                              {d.profileImage ? (
                                <img 
                                  src={d.profileImage} 
                                  alt={d.name || 'Driver'} 
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                                  {d.name ? d.name.charAt(0).toUpperCase() : 'D'}
                                </div>
                              )}
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">{d.name || 'Unnamed Driver'}</h3>
                              </div>
                            </div>
                            
                            {/* Right Column - DL, Vehicle Class, and Actions */}
                            <div className="flex items-center space-x-6">
                              <div className="flex items-center space-x-4">
                                <span className="text-sm text-gray-600">DL: {d.dlNumber || 'N/A'}</span>
                                <span className="text-sm text-gray-600">
                                  {Array.isArray(d.vehicleClass) ? d.vehicleClass.join(', ') : (d.vehicleClass || 'N/A')}
                                </span>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                  onClick={() => toggleDriverDetails(d._id || d.id)}
                                >
                                  {expandedDriver === (d._id || d.id) ? 'Hide Details' : 'View Details'}
                                </button>
                                <button
                                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md text-sm"
                                  onClick={() => { setSelectedDriver(d); setOfferForm({ message: '', salaryPerDay: '' }); setShowOfferModal(true); }}
                                >
                                  Send Job Offer
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Driver Details */}
                        {expandedDriver === (d._id || d.id) && (
                          <div className="border-t bg-gray-50 p-5">
                            {loadingDetails ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-sm text-gray-600">Loading details...</span>
                              </div>
                            ) : driverDetails[d._id || d.id] ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <p className="text-sm text-gray-900">{driverDetails[d._id || d.id].name || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">DL Number</label>
                                    <p className="text-sm text-gray-900">{driverDetails[d._id || d.id].dlNumber || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                    <p className="text-sm text-gray-900">
                                      {driverDetails[d._id || d.id].dateOfBirth ? new Date(driverDetails[d._id || d.id].dateOfBirth).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                                    <p className="text-sm text-gray-900">{driverDetails[d._id || d.id].bloodGroup || 'N/A'}</p>
                                  </div>
                                </div>
                                
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                    <p className="text-sm text-gray-900">{driverDetails[d._id || d.id].permanentAddress || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Classes</label>
                                    <p className="text-sm text-gray-900">
                                      {Array.isArray(driverDetails[d._id || d.id].vehicleClass) 
                                        ? driverDetails[d._id || d.id].vehicleClass.join(', ') 
                                        : (driverDetails[d._id || d.id].vehicleClass || 'N/A')
                                      }
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">DL Validity</label>
                                    <p className="text-sm text-gray-900">
                                      {driverDetails[d._id || d.id].dlValidity ? new Date(driverDetails[d._id || d.id].dlValidity).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      driverDetails[d._id || d.id].status === 'Available' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {driverDetails[d._id || d.id].status || 'N/A'}
                                    </span>
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
                  );
                })()}
              </div>
            </div>
          )}

          {activeSubTab.drivers === 'pending' && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Pending Job Offers</h3>
              <div className="bg-white">
                {pendingOffersLoading ? (
                  <div className="p-6 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading pending offers...</p>
                  </div>
                ) : pendingOffers.length === 0 ? (
                  <div className="text-center text-gray-600">
                    <p>No pending job offers.</p>
                    <p className="text-sm mt-2">All your job offers have been responded to.</p>
                  </div>
                ) : (() => {
                  const filteredOffers = filterDrivers(pendingOffers.map(offer => offer.driver)).map(driver => 
                    pendingOffers.find(offer => offer.driver._id === driver._id || offer.driver.id === driver.id)
                  );
                  return filteredOffers.length === 0 ? (
                    <div className="text-center text-gray-600">
                      <p>No pending offers match your search criteria.</p>
                      <p className="text-sm mt-2">Try adjusting your search terms or filters.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredOffers.map(offer => (
                      <div key={offer.id} className="border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                        <div className="p-5">
                          <div className="flex items-center justify-between">
                            {/* Left Column - Icon and Name */}
                            <div className="flex items-center space-x-4">
                              {offer.driver.profileImage ? (
                                <img 
                                  src={offer.driver.profileImage} 
                                  alt={offer.driver.name || 'Driver'} 
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                                  {offer.driver.name ? offer.driver.name.charAt(0).toUpperCase() : 'D'}
                                </div>
                              )}
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">{offer.driver.name || 'Unnamed Driver'}</h3>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">Pending Response</span>
                              </div>
                            </div>
                            
                            {/* Right Column - DL, Vehicle Class, and Salary */}
                            <div className="flex items-center space-x-6">
                              <div className="flex items-center space-x-4">
                                <span className="text-sm text-gray-600">DL: {offer.driver.dlNumber || 'N/A'}</span>
                                <span className="text-sm text-gray-600">
                                  {Array.isArray(offer.driver.vehicleClass) ? offer.driver.vehicleClass.join(', ') : (offer.driver.vehicleClass || 'N/A')}
                                </span>
                                <span className="text-sm text-gray-600">Salary: ₹{offer.salaryPerDay}/day</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Message and Date Info */}
                          <div className="mt-4 pt-4 border-t">
                            <div className="bg-gray-50 p-3 rounded-md">
                              <p className="text-sm text-gray-700 font-medium mb-1">Message:</p>
                              <p className="text-sm text-gray-600">{offer.message}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Sent: {new Date(offer.sentAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {activeSubTab.drivers === 'hired' && (
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Hired Drivers</h3>
              <div className="bg-white">
                {hiredDriversLoading ? (
                  <div className="p-6 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading hired drivers...</p>
                  </div>
                ) : hiredDrivers.length === 0 ? (
                  <div className="text-center text-gray-600">You have not hired any drivers yet.</div>
                ) : (() => {
                  const filteredHiredDrivers = filterDrivers(hiredDrivers);
                  return filteredHiredDrivers.length === 0 ? (
                    <div className="text-center text-gray-600">
                      <p>No hired drivers match your search criteria.</p>
                      <p className="text-sm mt-2">Try adjusting your search terms or filters.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredHiredDrivers.map(d => (
                      <div key={d._id || d.id} className="border rounded-lg shadow-sm bg-white hover:shadow-md transition-shadow">
                        <div className="p-5">
                          <div className="flex items-center justify-between">
                            {/* Left Column - Icon and Name */}
                            <div className="flex items-center space-x-4">
                              {d.profileImage ? (
                                <img 
                                  src={d.profileImage} 
                                  alt={d.name || 'Driver'} 
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                                  {d.name ? d.name.charAt(0).toUpperCase() : 'D'}
                                </div>
                              )}
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900">{d.name || 'Unnamed Driver'}</h3>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">Hired</span>
                              </div>
                            </div>
                            
                            {/* Right Column - DL, Vehicle Class, and Actions */}
                            <div className="flex items-center space-x-6">
                              <div className="flex items-center space-x-4">
                                <span className="text-sm text-gray-600">DL: {d.dlNumber || 'N/A'}</span>
                                <span className="text-sm text-gray-600">
                                  {Array.isArray(d.vehicleClass) ? d.vehicleClass.join(', ') : (d.vehicleClass || 'N/A')}
                                </span>
                              </div>
                              <div>
                                <button
                                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                                  onClick={() => toggleDriverDetails(d._id || d.id)}
                                >
                                  {expandedDriver === (d._id || d.id) ? 'Hide Details' : 'View Details'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Driver Details */}
                        {expandedDriver === (d._id || d.id) && (
                          <div className="border-t bg-gray-50 p-5">
                            {loadingDetails ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-sm text-gray-600">Loading details...</span>
                              </div>
                            ) : driverDetails[d._id || d.id] ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                    <p className="text-sm text-gray-900">{driverDetails[d._id || d.id].name || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">DL Number</label>
                                    <p className="text-sm text-gray-900">{driverDetails[d._id || d.id].dlNumber || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                    <p className="text-sm text-gray-900">
                                      {driverDetails[d._id || d.id].dateOfBirth ? new Date(driverDetails[d._id || d.id].dateOfBirth).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                                    <p className="text-sm text-gray-900">{driverDetails[d._id || d.id].bloodGroup || 'N/A'}</p>
                                  </div>
                                </div>
                                
                                <div className="space-y-3">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                    <p className="text-sm text-gray-900">{driverDetails[d._id || d.id].permanentAddress || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Classes</label>
                                    <p className="text-sm text-gray-900">
                                      {Array.isArray(driverDetails[d._id || d.id].vehicleClass) 
                                        ? driverDetails[d._id || d.id].vehicleClass.join(', ') 
                                        : (driverDetails[d._id || d.id].vehicleClass || 'N/A')
                                      }
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">DL Validity</label>
                                    <p className="text-sm text-gray-900">
                                      {driverDetails[d._id || d.id].dlValidity ? new Date(driverDetails[d._id || d.id].dlValidity).toLocaleDateString() : 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      driverDetails[d._id || d.id].status === 'Available' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {driverDetails[d._id || d.id].status || 'N/A'}
                                    </span>
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
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Send Job Offer Modal */}
      {showOfferModal && selectedDriver && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-24 mx-auto p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Send Job Offer</h3>
                <button onClick={() => setShowOfferModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea rows={3} value={offerForm.message} onChange={(e) => setOfferForm(prev => ({ ...prev, message: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Write a short message to the driver" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Salary / day (INR)</label>
                  <input type="number" min="0" value={offerForm.salaryPerDay} onChange={(e) => setOfferForm(prev => ({ ...prev, salaryPerDay: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., 1500" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setShowOfferModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">Cancel</button>
                <button onClick={async () => {
                  try {
                    const token = localStorage.getItem('token');
                    const res = await fetch('/api/job-offers', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ driverId: selectedDriver._id || selectedDriver.id, message: offerForm.message, salaryPerDay: Number(offerForm.salaryPerDay) })
                    });
                    if (res.ok) {
                      toast.success('Offer sent');
                      setShowOfferModal(false);
                      // Refresh available drivers and pending offers
                      fetchAvailableDrivers();
                      fetchPendingOffers();
                    } else {
                      const err = await res.json();
                      toast.error(err.message || 'Failed to send offer');
                    }
                  } catch (e) {
                    console.error(e);
                    toast.error('Failed to send offer');
                  }
                }} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md">Send Offer</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriversPage;
