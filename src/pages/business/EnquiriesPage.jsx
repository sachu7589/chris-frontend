import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';

const EnquiriesPage = () => {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [showCreateTripModal, setShowCreateTripModal] = useState(false);
  const [tripForm, setTripForm] = useState({
    driverId: '',
    startCoords: { lat: 0, lng: 0 },
    endCoords: { lat: 0, lng: 0 },
    distanceKm: 0,
    ratePerKm: 0,
    vehicleRent: 0,
    driverBata: 0,
    route: [],
    waypoints: []
  });
  const [mapInstance, setMapInstance] = useState(null);
  const [routeLayer, setRouteLayer] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [suggestions, setSuggestions] = useState({ start: [], end: [] });
  const [showEnquiryDetails, setShowEnquiryDetails] = useState(false);
  const [selectedEnquiryDetails, setSelectedEnquiryDetails] = useState(null);
  const [drivers, setDrivers] = useState([]);

  // Fetch enquiries
  const fetchEnquiries = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No authentication token found');
        toast.error('Please log in to view enquiries');
        return;
      }
      
      const res = await fetch('/api/enquiries/business', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('API Error:', errorData);
        throw new Error(errorData.message || 'Failed to load enquiries');
      }
      
      const data = await res.json();
      setEnquiries(data.enquiries || []);
    } catch (error) {
      console.error('Error fetching enquiries:', error);
      toast.error('Failed to load enquiries: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch only hired drivers with salary information
  const fetchDrivers = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch only hired drivers and job offers
      const [hiredRes, jobOffersRes] = await Promise.all([
        fetch('/api/drivers/hired', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/job-offers/business', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      if (!hiredRes.ok) {
        throw new Error('Failed to load drivers');
      }
      
      const [hiredData, jobOffersData] = await Promise.all([
        hiredRes.ok ? hiredRes.json() : { drivers: [] },
        jobOffersRes.ok ? jobOffersRes.json() : { jobOffers: [] }
      ]);
      
      // Create a map of driver salaries from accepted job offers
      const driverSalaries = {};
      if (jobOffersData.jobOffers) {
        jobOffersData.jobOffers.forEach(offer => {
          if (offer.status === 'accepted') {
            driverSalaries[offer.driverId] = offer.salaryPerDay;
          }
        });
      }
      
      // Only show hired drivers with salary info
      const hiredDrivers = (hiredData.drivers || []).map(driver => ({
        ...driver,
        acceptedSalary: driverSalaries[driver._id] || 0
      }));
      
      setDrivers(hiredDrivers);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      toast.error('Failed to load drivers');
    }
  };

  // Search for places using Nominatim
  const searchPlace = async (query) => {
    if (!query || query.length < 3) return [];
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=IN`;
      const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
      const data = await res.json();
      return data.map(item => ({
        display: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon)
      }));
    } catch (error) {
      console.error('Error searching places:', error);
      return [];
    }
  };

  // Handle place search
  const handlePlaceSearch = async (index, value) => {
    setTripForm(prev => {
      const next = { ...prev };
      if (!next.waypoints) next.waypoints = [];
      next.waypoints[index] = { ...(next.waypoints[index] || {}), address: value };
      return next;
    });
    
    try {
      const results = await searchPlace(value);
      setSuggestions(prev => ({ ...prev, [index]: results }));
    } catch (error) {
      console.error('Error in place search:', error);
    }
  };

  // Pick a suggestion
  const pickSuggestion = (index, suggestion) => {
    setTripForm(prev => {
      const next = { ...prev };
      if (!next.waypoints) next.waypoints = [];
      next.waypoints[index] = { 
        address: suggestion.display, 
        coords: { lat: suggestion.lat, lng: suggestion.lng } 
      };
      return next;
    });
    
    if (mapInstance) {
      mapInstance.setView([suggestion.lat, suggestion.lng], 12);
    }
    setSuggestions(prev => ({ ...prev, [index]: [] }));
  };

  // Compute route using multiple routing services
  const computeRoute = useCallback(async () => {
    if (!tripForm.waypoints || tripForm.waypoints.length < 2) return;
    const coords = tripForm.waypoints.filter(w => w?.coords).map(w => `${w.coords.lng},${w.coords.lat}`);
    if (coords.length < 2) return;
    
    const startCoords = tripForm.waypoints[0]?.coords;
    const endCoords = tripForm.waypoints[tripForm.waypoints.length - 1]?.coords;
    
    if (!startCoords || !endCoords) return;
    
    try {
      // Try backend routing service first (most reliable)
      try {
        console.log('Trying Backend Route Service...');
        const backendUrl = `http://localhost:5000/api/enquiries/route?startLat=${startCoords.lat}&startLng=${startCoords.lng}&endLat=${endCoords.lat}&endLng=${endCoords.lng}`;
        const res = await fetch(backendUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.route) {
            console.log(`Success with Backend Route Service (${data.service})`);
            setTripForm(prev => ({ ...prev, route: data.route, distanceKm: data.distance }));
            
            if (mapInstance) {
              drawRoute(data.route);
            }
            return;
          }
        }
      } catch (backendError) {
        console.log('Backend Route Service failed:', backendError);
      }
      
      // Fallback: Create enhanced vehicle route with realistic waypoints
      console.log('Using enhanced vehicle route fallback');
      const vehicleRoute = createVehicleRoute(startCoords, endCoords);
      const distanceKm = calculateVehicleRouteDistance(vehicleRoute);
      
      setTripForm(prev => ({ ...prev, route: vehicleRoute, distanceKm }));
      
      if (mapInstance) {
        drawRoute(vehicleRoute);
      }
      
    } catch (error) {
      console.error('All routing failed:', error);
      
      // Final fallback: Enhanced vehicle route with waypoints
      const vehicleRoute = createVehicleRoute(startCoords, endCoords);
      const distanceKm = calculateVehicleRouteDistance(vehicleRoute);
      
      setTripForm(prev => ({ ...prev, route: vehicleRoute, distanceKm }));
      
      if (mapInstance) {
        drawRoute(vehicleRoute);
      }
    }
  }, [tripForm.waypoints, mapInstance]);

  // Create realistic vehicle route with road-like waypoints
  const createVehicleRoute = (start, end) => {
    const route = [start];
    
    // Calculate direction and distance
    const latDiff = end.lat - start.lat;
    const lngDiff = end.lng - start.lng;
    const distance = calculateDistance(start, end);
    
    // Create realistic vehicle route with multiple waypoints
    const numWaypoints = Math.max(3, Math.min(8, Math.floor(distance / 10))); // More waypoints for longer distances
    
    for (let i = 1; i <= numWaypoints; i++) {
      const factor = i / (numWaypoints + 1);
      
      // Add some randomness to simulate road curves
      const randomLatOffset = (Math.random() - 0.5) * 0.01; // Small random offset
      const randomLngOffset = (Math.random() - 0.5) * 0.01;
      
      const waypoint = {
        lat: start.lat + (latDiff * factor) + randomLatOffset,
        lng: start.lng + (lngDiff * factor) + randomLngOffset
      };
      
      route.push(waypoint);
    }
    
    route.push(end);
    return route;
  };

  // Calculate distance for vehicle route with road factor
  const calculateVehicleRouteDistance = (route) => {
    let totalDistance = 0;
    for (let i = 0; i < route.length - 1; i++) {
      totalDistance += calculateDistance(route[i], route[i + 1]);
    }
    // Add road factor (40% for realistic vehicle routing)
    return +(totalDistance * 1.4).toFixed(2);
  };

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (coord1, coord2) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return +(R * c).toFixed(2);
  };

  // Draw route on map with markers
  const drawRoute = (coords) => {
    if (!mapInstance) return;
    
    // Remove existing route and markers
    if (routeLayer) {
      mapInstance.removeLayer(routeLayer);
    }
    
    // Clear existing markers
    markers.forEach(marker => {
      if (mapInstance.hasLayer(marker)) {
        mapInstance.removeLayer(marker);
      }
    });
    
    // Add new route
    const newRouteLayer = L.polyline(coords.map(c => [c.lat, c.lng]), { 
      color: '#3B82F6', 
      weight: 4,
      opacity: 0.8
    }).addTo(mapInstance);
    
    setRouteLayer(newRouteLayer);
    
    // Add markers for start and end points
    const newMarkers = [];
    if (coords.length > 0) {
      // Start marker
      const startMarker = L.marker([coords[0].lat, coords[0].lng], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: '<div style="background-color: #10B981; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">S</div>',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).bindPopup('Start Point').addTo(mapInstance);
      newMarkers.push(startMarker);
      
      // End marker
      if (coords.length > 1) {
        const endMarker = L.marker([coords[coords.length - 1].lat, coords[coords.length - 1].lng], {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color: #EF4444; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">E</div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).bindPopup('End Point').addTo(mapInstance);
        newMarkers.push(endMarker);
      }
    }
    
    setMarkers(newMarkers);
    
    // Fit bounds to show the entire route
    if (coords.length > 1) {
      const bounds = L.latLngBounds(coords.map(c => [c.lat, c.lng]));
      mapInstance.fitBounds(bounds, { padding: [20, 20] });
    } else if (coords.length === 1) {
      mapInstance.setView([coords[0].lat, coords[0].lng], 12);
    }
  };


  // Create trip from enquiry
  const createTripFromEnquiry = async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Validate that we have a selected enquiry
      if (!selectedEnquiry || !selectedEnquiry._id) {
        throw new Error('No enquiry selected. Please select an enquiry first.');
      }
      
      // Validate enquiry status
      if (selectedEnquiry.status !== 'pending' && selectedEnquiry.status !== 'responded') {
        throw new Error('Cannot create trip from this enquiry. Only pending or responded enquiries can be converted to trips.');
      }
      
      // Calculate total amount
      const totalAmount = (tripForm.distanceKm * tripForm.ratePerKm) + tripForm.vehicleRent + tripForm.driverBata;
      
      const payload = {
        driverId: tripForm.driverId,
        startCoords: tripForm.waypoints[0]?.coords || tripForm.startCoords,
        endCoords: tripForm.waypoints[tripForm.waypoints.length - 1]?.coords || tripForm.endCoords,
        distanceKm: tripForm.distanceKm,
        ratePerKm: tripForm.ratePerKm,
        vehicleRent: tripForm.vehicleRent,
        driverBata: tripForm.driverBata,
        route: tripForm.route,
        totalAmount: totalAmount
      };
      
      const res = await fetch(`/api/enquiries/${selectedEnquiry._id}/create-trip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Create trip error response:', errorData);
        
        if (res.status === 404) {
          throw new Error('Enquiry not found. Please refresh the page and try again.');
        } else if (res.status === 403) {
          throw new Error('You are not authorized to create a trip from this enquiry.');
        } else if (res.status === 400) {
          throw new Error(errorData.message || 'Invalid request data. Please check all fields.');
        } else {
          throw new Error(errorData.message || 'Server error while creating trip');
        }
      }
      
      const data = await res.json();
      toast.success('Trip created successfully! Payment request sent to customer.');
      setShowCreateTripModal(false);
      setTripForm({
        driverId: '',
        startCoords: { lat: 0, lng: 0 },
        endCoords: { lat: 0, lng: 0 },
        distanceKm: 0,
        ratePerKm: 0,
        vehicleRent: 0,
        driverBata: 0,
        route: [],
        waypoints: []
      });
      // Refresh enquiries to show updated status
      await fetchEnquiries();
    } catch (error) {
      console.error('Error creating trip:', error);
      toast.error('Failed to create trip: ' + error.message);
      
      // If it's a 404 or 403 error, refresh the enquiries list
      if (error.message.includes('Enquiry not found') || error.message.includes('Unauthorized') || error.message.includes('belongs to a different business')) {
        console.log('Refreshing enquiries list due to error');
        await fetchEnquiries();
        setShowCreateTripModal(false);
        setSelectedEnquiry(null);
        toast.error('This enquiry is no longer available. Please refresh the page and try again.');
      }
    }
  };

  // Open create trip modal
  const openCreateTripModal = async (enquiry) => {
    try {
      // Validate enquiry before opening modal
      if (!enquiry || !enquiry._id) {
        toast.error('Invalid enquiry selected');
        return;
      }
      
      // Check if enquiry exists in current enquiries list
      const currentEnquiry = enquiries.find(e => e._id === enquiry._id);
      if (!currentEnquiry) {
        toast.error('Enquiry not found. Please refresh the page and try again.');
        await fetchEnquiries();
        return;
      }
      
      // Use the current enquiry data to ensure it's up to date
      const updatedEnquiry = currentEnquiry;
      
      // Check if enquiry is in correct state
      if (updatedEnquiry.status !== 'pending' && updatedEnquiry.status !== 'responded') {
        toast.error('Cannot create trip from this enquiry. Only pending or responded enquiries can be converted to trips.');
        return;
      }
      
      setSelectedEnquiry(updatedEnquiry);
      setShowCreateTripModal(true);
      await fetchDrivers();
    
    // Pre-fill trip form with enquiry data
    setTripForm({
      driverId: '',
      startCoords: updatedEnquiry.startCoords || { lat: 0, lng: 0 },
      endCoords: updatedEnquiry.endCoords || { lat: 0, lng: 0 },
      distanceKm: updatedEnquiry.distanceKm || 0,
      ratePerKm: 0,
      vehicleRent: 0,
      driverBata: 0,
      route: [],
      waypoints: [
        { address: updatedEnquiry.startingPoint || '', coords: updatedEnquiry.startCoords || null },
        { address: updatedEnquiry.destination || '', coords: updatedEnquiry.endCoords || null }
      ]
    });
    
    // Auto-compute route if coordinates are available
    if (updatedEnquiry.startCoords && updatedEnquiry.endCoords) {
      setTimeout(() => {
        computeRoute();
      }, 500);
    }
    } catch (error) {
      console.error('Error opening create trip modal:', error);
      toast.error('Failed to open trip creation modal: ' + error.message);
    }
  };

  // Initialize map when modal opens
  useEffect(() => {
    if (showCreateTripModal && typeof window !== 'undefined' && window.L) {
      // Small delay to ensure DOM is rendered
      setTimeout(() => {
        const mapContainer = document.getElementById('trip-map');
        if (mapContainer && !mapInstance) {
          const map = window.L.map('trip-map', {
            zoomControl: true,
            scrollWheelZoom: false,
            preferCanvas: true
          }).setView([20.5937, 78.9629], 5);
          
          window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
          }).addTo(map);
          
          setMapInstance(map);
        }
      }, 100);
    }
    
    // Cleanup when modal closes
    if (!showCreateTripModal && mapInstance) {
      // Clear markers
      markers.forEach(marker => {
        if (mapInstance.hasLayer(marker)) {
          mapInstance.removeLayer(marker);
        }
      });
      setMarkers([]);
      
      // Clear route
      if (routeLayer) {
        mapInstance.removeLayer(routeLayer);
        setRouteLayer(null);
      }
    }
  }, [showCreateTripModal, mapInstance, markers, routeLayer]);


  // Auto-compute route when waypoints change and map is available
  useEffect(() => {
    if (mapInstance && tripForm.waypoints && tripForm.waypoints.length >= 2) {
      const hasCoords = tripForm.waypoints.every(w => w?.coords);
      if (hasCoords) {
        // Small delay to ensure map is fully rendered
        setTimeout(() => {
          computeRoute();
        }, 200);
      }
    }
  }, [mapInstance, tripForm.waypoints, computeRoute]);

  // Auto-compute route when enquiry data is loaded
  useEffect(() => {
    if (mapInstance && selectedEnquiry && tripForm.waypoints && tripForm.waypoints.length >= 2) {
      const hasCoords = tripForm.waypoints.every(w => w?.coords);
      if (hasCoords) {
        setTimeout(() => {
          computeRoute();
        }, 300);
      }
    }
  }, [mapInstance, selectedEnquiry, tripForm.waypoints, computeRoute]);

  // Open enquiry details modal
  const openEnquiryDetails = (enquiry) => {
    setSelectedEnquiryDetails(enquiry);
    setShowEnquiryDetails(true);
  };

  // Load enquiries on component mount
  useEffect(() => {
    fetchEnquiries();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'responded': return 'bg-blue-100 text-blue-800';
      case 'trip_created': return 'bg-green-100 text-green-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Customer Enquiries</h2>
        <div className="flex space-x-2">
          <button 
            onClick={fetchEnquiries} 
            disabled={loading}
            className="text-sm px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button 
            onClick={async () => {
              await fetchEnquiries();
              toast.success('Enquiries refreshed');
            }} 
            disabled={loading}
            className="text-sm px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Refreshing...' : 'Force Refresh'}
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="p-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">All Enquiries ({enquiries.length})</h3>
        </div>
        
        {loading ? (
          <div className="p-6">Loading enquiries...</div>
        ) : enquiries.length === 0 ? (
          <div className="p-6 text-gray-600">No enquiries yet.</div>
        ) : (
          <div className="p-4 space-y-4">
            {enquiries.map((enquiry) => (
              <div key={enquiry._id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="text-sm font-medium text-gray-900">
                        {enquiry.vehicleId?.registeredNumber} - {enquiry.vehicleId?.makersName}
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(enquiry.status)}`}>
                        {enquiry.status.replace('_', ' ')}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                      <div>
                        <strong>Customer:</strong> {enquiry.customerId?.name || enquiry.customerId?.email}
                      </div>
                      <div>
                        <strong>Vehicle Class:</strong> {enquiry.vehicleId?.vehicleClass}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-2">
                      <strong>Route:</strong> {enquiry.startingPoint} → {enquiry.destination}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                      <div>
                        <strong>Dates:</strong> {new Date(enquiry.startDate).toLocaleDateString()} - {new Date(enquiry.endDate).toLocaleDateString()}
                      </div>
                      {enquiry.distanceKm > 0 && (
                        <div>
                          <strong>Distance:</strong> {enquiry.distanceKm} km
                        </div>
                      )}
                    </div>
                    
                    {enquiry.message && (
                      <div className="text-sm text-gray-600 mb-2">
                        <strong>Message:</strong> {enquiry.message}
                      </div>
                    )}
                    
                    {enquiry.businessResponse?.message && (
                      <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                        <strong>Your Response:</strong> {enquiry.businessResponse.message}
                      </div>
                    )}
                    
                    {enquiry.status === 'trip_created' && (
                      <div className="mt-2 p-2 bg-green-50 rounded text-sm">
                        <strong>Trip Created!</strong> Total: ₹{enquiry.totalAmount?.toLocaleString()} • 
                        Advance Required: ₹{enquiry.advanceAmount?.toLocaleString()}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col space-y-2 ml-4">
                    <button
                      onClick={() => openEnquiryDetails(enquiry)}
                      className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                    >
                      View Details
                    </button>
                    
                    {(enquiry.status === 'pending' || enquiry.status === 'responded') && (
                      <button
                        onClick={() => openCreateTripModal(enquiry)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Create Trip
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Enhanced Create Trip Modal */}
      {showCreateTripModal && selectedEnquiry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">Create Trip from Enquiry</h3>
              <button
                onClick={() => setShowCreateTripModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm font-medium text-gray-900">
                  {selectedEnquiry.vehicleId?.registeredNumber} - {selectedEnquiry.vehicleId?.makersName}
                </div>
                <div className="text-xs text-gray-600">
                  {selectedEnquiry.startingPoint} → {selectedEnquiry.destination}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column - Form */}
                <div className="space-y-4">
                  {/* Route Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Route</label>
                    <div className="space-y-2">
                      {tripForm.waypoints?.map((waypoint, index) => (
                        <div key={index} className="relative">
                          <input
                            value={waypoint?.address || ''}
                            onChange={(e) => handlePlaceSearch(index, e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={index === 0 ? 'Starting point...' : 'Destination...'}
                          />
                          {suggestions[index]?.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-auto">
                              {suggestions[index].map((suggestion, sIndex) => (
                                <button
                                  key={sIndex}
                                  type="button"
                                  onClick={() => pickSuggestion(index, suggestion)}
                                  className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                                >
                                  {suggestion.display}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Driver Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Driver</label>
                    <select
                      value={tripForm.driverId}
                      onChange={(e) => {
                        const selectedDriver = drivers.find(d => d._id === e.target.value);
                        setTripForm(prev => ({ 
                          ...prev, 
                          driverId: e.target.value,
                          driverBata: selectedDriver?.acceptedSalary || 0
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a driver</option>
                      {drivers.map((driver) => (
                        <option key={driver._id} value={driver._id}>
                          {driver.name} - {driver.licenseNumber} 
                          {driver.acceptedSalary > 0 && ` (₹${driver.acceptedSalary}/day)`}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Distance (km)</label>
                      <input
                        type="number"
                        value={tripForm.distanceKm}
                        onChange={(e) => setTripForm(prev => ({ ...prev, distanceKm: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Distance in km"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rate per km (₹)</label>
                      <input
                        type="number"
                        value={tripForm.ratePerKm}
                        onChange={(e) => setTripForm(prev => ({ ...prev, ratePerKm: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Rate per km"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Rent (₹)</label>
                      <input
                        type="number"
                        value={tripForm.vehicleRent}
                        onChange={(e) => setTripForm(prev => ({ ...prev, vehicleRent: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Vehicle rent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Driver Bata (₹)</label>
                      <input
                        type="number"
                        value={tripForm.driverBata}
                        onChange={(e) => setTripForm(prev => ({ ...prev, driverBata: parseFloat(e.target.value) }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Driver bata"
                      />
                    </div>
                  </div>
                  

                  {/* Total Amount Display */}
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-800">
                      <strong>Total Amount:</strong> ₹{((tripForm.distanceKm * tripForm.ratePerKm) + tripForm.vehicleRent + tripForm.driverBata).toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-600">
                      Advance Required: ₹{Math.round(((tripForm.distanceKm * tripForm.ratePerKm) + tripForm.vehicleRent + tripForm.driverBata) * 20 / 100).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Right Column - Map */}
                <div className="bg-gray-100 rounded-lg overflow-hidden">
                  <div id="trip-map" className="w-full h-96"></div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowCreateTripModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={createTripFromEnquiry}
                  disabled={!tripForm.driverId || !tripForm.distanceKm || !tripForm.ratePerKm || !selectedEnquiry || (selectedEnquiry.status !== 'pending' && selectedEnquiry.status !== 'responded')}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg"
                >
                  Create Trip & Send Payment Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enquiry Details Modal */}
      {showEnquiryDetails && selectedEnquiryDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Enquiry Details</h3>
              <button
                onClick={() => setShowEnquiryDetails(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Vehicle Information */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Vehicle Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div><strong>Registration:</strong> {selectedEnquiryDetails.vehicleId?.registeredNumber}</div>
                  <div><strong>Make/Model:</strong> {selectedEnquiryDetails.vehicleId?.makersName}</div>
                  <div><strong>Class:</strong> {selectedEnquiryDetails.vehicleId?.vehicleClass}</div>
                  <div><strong>Type:</strong> {selectedEnquiryDetails.vehicleId?.vehicleType}</div>
                  <div><strong>Seating:</strong> {selectedEnquiryDetails.vehicleId?.seatingCapacity} seats</div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Customer Information</h4>
                <div className="text-sm">
                  <div><strong>Name:</strong> {selectedEnquiryDetails.customerId?.name || 'N/A'}</div>
                  <div><strong>Email:</strong> {selectedEnquiryDetails.customerId?.email}</div>
                </div>
              </div>

              {/* Trip Details */}
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Trip Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div><strong>From:</strong> {selectedEnquiryDetails.startingPoint}</div>
                  <div><strong>To:</strong> {selectedEnquiryDetails.destination}</div>
                  <div><strong>Start Date:</strong> {new Date(selectedEnquiryDetails.startDate).toLocaleDateString()}</div>
                  <div><strong>End Date:</strong> {new Date(selectedEnquiryDetails.endDate).toLocaleDateString()}</div>
                  {selectedEnquiryDetails.distanceKm > 0 && (
                    <div><strong>Distance:</strong> {selectedEnquiryDetails.distanceKm} km</div>
                  )}
                </div>
              </div>

              {/* Customer Message */}
              {selectedEnquiryDetails.message && (
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Customer Message</h4>
                  <p className="text-sm text-gray-700">{selectedEnquiryDetails.message}</p>
                </div>
              )}

              {/* Business Response */}
              {selectedEnquiryDetails.businessResponse?.message && (
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Your Response</h4>
                  <p className="text-sm text-gray-700 mb-2">{selectedEnquiryDetails.businessResponse.message}</p>
                  <div className="text-xs text-gray-500">
                    <strong>Advance Percentage:</strong> {selectedEnquiryDetails.businessResponse.advancePercentage}%
                  </div>
                  <div className="text-xs text-gray-500">
                    <strong>Responded:</strong> {new Date(selectedEnquiryDetails.businessResponse.respondedAt).toLocaleString()}
                  </div>
                </div>
              )}

              {/* Trip Information */}
              {selectedEnquiryDetails.status === 'trip_created' && (
                <div className="bg-green-100 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Trip Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <div><strong>Total Amount:</strong> ₹{selectedEnquiryDetails.totalAmount?.toLocaleString()}</div>
                    <div><strong>Advance Required:</strong> ₹{selectedEnquiryDetails.advanceAmount?.toLocaleString()}</div>
                    <div><strong>Payment Status:</strong> {selectedEnquiryDetails.paymentStatus}</div>
                    {selectedEnquiryDetails.tripId && (
                      <div><strong>Trip ID:</strong> {selectedEnquiryDetails.tripId.trip_id}</div>
                    )}
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="bg-gray-100 p-4 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Status</h4>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(selectedEnquiryDetails.status)}`}>
                    {selectedEnquiryDetails.status.replace('_', ' ')}
                  </span>
                  <span className="text-sm text-gray-600">
                    Created: {new Date(selectedEnquiryDetails.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowEnquiryDetails(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                Close
              </button>
              {selectedEnquiryDetails.status === 'pending' && (
                <>
                  <button
                    onClick={() => {
                      setShowEnquiryDetails(false);
                      // TODO: Implement reject functionality
                      console.log('Reject enquiry:', selectedEnquiryDetails._id);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => {
                      setShowEnquiryDetails(false);
                      openCreateTripModal(selectedEnquiryDetails);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-500 hover:bg-green-600 rounded-lg"
                  >
                    Create Trip
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnquiriesPage;
