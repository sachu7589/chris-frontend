import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const ProfilePage = ({ onProfileUpdate }) => {
  const [businessProfile, setBusinessProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    profileIcon: null,
    email: '', // Read-only field
    companyName: '',
    ownerName: '',
    contactNumber: '',
    panCard: '',
    panCardImage: null,
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    }
  });

  const [location, setLocation] = useState({
    coordinates: null,
    address: ''
  });

  const [showMap, setShowMap] = useState(false);
  const [map, setMap] = useState(null);
  const [marker, setMarker] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [isExtractingPAN, setIsExtractingPAN] = useState(false);
  const [updatedFields, setUpdatedFields] = useState([]);
  const [addressValidation, setAddressValidation] = useState({
    isValid: null,
    suggestions: [],
    loading: false
  });
  const [mapError, setMapError] = useState(false);
  const mapRef = useRef(null);
  const profileIconRef = useRef(null);
  const panCardImageRef = useRef(null);

  useEffect(() => {
    fetchBusinessProfile();
  }, []);

  // Set editing mode if no profile exists
  useEffect(() => {
    if (businessProfile === null && !loading) {
      setIsEditing(true);
    }
  }, [businessProfile, loading]);

  // Show map by default when editing
  useEffect(() => {
    if (isEditing) {
      setShowMap(true);
    }
  }, [isEditing]);

  // Initialize map when showMap becomes true
  useEffect(() => {
    if (showMap && !map && mapRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        console.log('Initializing Leaflet map...');
        try {
          const leafletMap = L.map(mapRef.current).setView([28.6139, 77.2090], 10); // Default to Delhi

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(leafletMap);

          setMap(leafletMap);
          console.log('Map initialized successfully');

          // Add click handler to map
          leafletMap.on('click', (e) => {
            const { lat, lng } = e.latlng;
            console.log('Map clicked:', lat, lng);
            setLocation(prev => ({
              ...prev,
              coordinates: { lat, lng }
            }));

            // Update marker
            if (marker) {
              leafletMap.removeLayer(marker);
            }
            const newMarker = L.marker([lat, lng]).addTo(leafletMap);
            setMarker(newMarker);

            // Reverse geocode to get address
            reverseGeocode(lat, lng);
          });
        } catch (error) {
          console.error('Error initializing map:', error);
          setMapError(true);
        }
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [showMap, map]);

  // Update map when location changes
  useEffect(() => {
    if (map && location.coordinates) {
      console.log('Updating map location:', location.coordinates);
      map.setView([location.coordinates.lat, location.coordinates.lng], 15);
      
      // Remove existing marker
      if (marker) {
        map.removeLayer(marker);
      }
      
      // Add new marker
      const newMarker = L.marker([location.coordinates.lat, location.coordinates.lng]).addTo(map);
      setMarker(newMarker);
    }
  }, [location.coordinates, map]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (map) {
        console.log('Cleaning up map...');
        map.remove();
      }
    };
  }, [map]);

  const fetchBusinessProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found for business profile');
        return;
      }

      const response = await fetch('/api/business/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBusinessProfile(data.business);
        
        // Initialize form data
        setFormData({
          profileIcon: data.business.profileIcon || null,
          email: data.business.userId?.email || '',
          companyName: data.business.companyName || '',
          ownerName: data.business.ownerName || '',
          contactNumber: data.business.contactNumber || '',
          panCard: data.business.panCard || '',
          panCardImage: data.business.panCardImage || null,
          address: {
            line1: data.business.address?.line1 || '',
            line2: data.business.address?.line2 || '',
            city: data.business.address?.city || '',
            state: data.business.address?.state || '',
            pincode: data.business.address?.pincode || '',
            country: data.business.address?.country || 'India'
          }
        });

        // Initialize location data
        if (data.business.location && data.business.location.coordinates) {
          setLocation({
            coordinates: {
              lat: data.business.location.coordinates[1],
              lng: data.business.location.coordinates[0]
            },
            address: data.business.location.address || ''
          });
        }
        
        console.log('Business profile fetched:', data.business);
      } else if (response.status === 404) {
        console.log('Business profile not found, fetching user info');
        setBusinessProfile(null);
        
        // Fetch user information to get email
        await fetchUserInfo();
      } else {
        console.error('Failed to fetch business profile:', response.status);
        toast.error('Failed to load business profile');
      }
    } catch (error) {
      console.error('Error fetching business profile:', error);
      toast.error('Error loading business profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found for user info');
        return;
      }

      const response = await fetch('/api/business/user-info', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('User info fetched:', data.user);
        
        // Initialize form data with user email
        setFormData(prev => ({
          ...prev,
          email: data.user.email || ''
        }));
      } else {
        console.error('Failed to fetch user info:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
    }
  };

  const saveBusinessProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const profileData = {
        ...formData,
        location: location.coordinates ? {
          coordinates: location.coordinates,
          address: location.address,
          accuracy: location.accuracy || null,
          source: location.source || 'manual',
          confidence: location.confidence || null
        } : null
      };
      
      console.log('Sending profile data:', JSON.stringify(profileData, null, 2));
      
      const response = await fetch('/api/business/profile', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      if (response.ok) {
        const data = await response.json();
        setBusinessProfile(data.business);
        setIsEditing(false);
        toast.success('Business profile saved successfully!');
        console.log('Business profile saved:', data.business);
        
        // Notify parent component to refresh business profile
        if (onProfileUpdate) {
          onProfileUpdate();
        }
      } else {
        const errorData = await response.json();
        console.error('Profile save error:', errorData);
        console.error('Response status:', response.status);
        toast.error('Error saving profile: ' + errorData.message);
      }
    } catch (error) {
      console.error('Error saving business profile:', error);
      toast.error('Error saving business profile');
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleImageUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (type === 'profileIcon') {
          setFormData(prev => ({
            ...prev,
            profileIcon: e.target.result
          }));
        } else if (type === 'panCardImage') {
          setFormData(prev => ({
            ...prev,
            panCardImage: e.target.result
          }));
          // Extract PAN data automatically
          extractPANData(e.target.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const extractPANData = async (imageBase64) => {
    try {
      setIsExtractingPAN(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Please login first');
        return;
      }

      console.log('Extracting PAN data...');
      
      const response = await fetch('/api/business/extract-pan', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imageUrl: imageBase64 })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('PAN extraction response:', data);
        
        if (data.data && data.data.panNumber) {
          const updatedFieldsList = [];
          
          setFormData(prev => {
            const newForm = {
              ...prev,
              panCard: data.data.panNumber || prev.panCard
            };
            
            if (data.data.panNumber) {
              updatedFieldsList.push('PAN Card Number');
            }
            
            return newForm;
          });
          
          setUpdatedFields(updatedFieldsList);
          console.log('PAN data extracted successfully');
          toast.success(`Updated: ${updatedFieldsList.join(', ')}`);
          
          // Clear highlight after 3 seconds
          setTimeout(() => {
            setUpdatedFields([]);
          }, 3000);
        } else {
          console.warn('No PAN number found in image');
          toast.error('No PAN number found in the image');
          // Remove the uploaded file on failure
          clearPANImage();
        }
      } else {
        const errorData = await response.json();
        console.error('PAN extraction failed:', errorData);
        
        // Handle specific error cases
        if (errorData.error && errorData.error.includes('Insufficient credits')) {
          toast.error('PAN extraction service is temporarily unavailable. Please enter the PAN number manually.');
        } else if (errorData.error && errorData.error.includes('API key not configured')) {
          toast.error('PAN extraction service is not configured. Please enter the PAN number manually.');
        } else {
          toast.error('Failed to extract PAN data: ' + (errorData.message || 'Unknown error'));
        }
        
        // Remove the uploaded file on failure
        clearPANImage();
      }
    } catch (error) {
      console.error('Error extracting PAN data:', error);
      toast.error('Error extracting PAN data: ' + error.message);
      // Remove the uploaded file on failure
      clearPANImage();
    } finally {
      setIsExtractingPAN(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log('Current location:', latitude, longitude);
        setLocation(prev => ({
          ...prev,
          coordinates: { lat: latitude, lng: longitude },
          source: 'gps'
        }));
        reverseGeocode(latitude, longitude);
        setLocationLoading(false);
      },
      (error) => {
        console.error('Error getting location:', error);
        toast.error('Unable to get your location');
        setLocationLoading(false);
      }
    );
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(`/api/maps/reverse-geocode?lat=${lat}&lng=${lng}`);
      if (response.ok) {
        const data = await response.json();
        setLocation(prev => ({
          ...prev,
          address: data.address
        }));
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  const geocodeAddress = async () => {
    const fullAddress = `${formData.address.line1 || ''}${formData.address.line2 ? ', ' + formData.address.line2 : ''}, ${formData.address.city || ''}, ${formData.address.state || ''} ${formData.address.pincode || ''}, ${formData.address.country || 'India'}`;
    
    if (!formData.address.line1 && !formData.address.city && !formData.address.state && !formData.address.pincode) {
      toast.error('Please enter at least some address information to find location');
      return;
    }
    
    try {
      setLocationLoading(true);
      const response = await fetch(`/api/maps/geocode-enhanced?address=${encodeURIComponent(fullAddress)}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Geocoding result:', data);
        setLocation({
          coordinates: data.coordinates,
          address: data.address,
          confidence: data.confidence,
          source: 'geocoded'
        });
        
        toast.success(`Location found! (Confidence: ${Math.round(data.confidence * 100)}%)`);
      } else {
        toast.error('Address not found');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Error finding location');
    } finally {
      setLocationLoading(false);
    }
  };

  const clearLocation = () => {
    setLocation({
      coordinates: null,
      address: ''
    });
    if (marker && map) {
      map.removeLayer(marker);
      setMarker(null);
    }
  };

  const clearPANImage = () => {
    setFormData(prev => ({
      ...prev,
      panCardImage: null
    }));
    // Clear the file input
    if (panCardImageRef.current) {
      panCardImageRef.current.value = '';
    }
  };

  const isFieldUpdated = (fieldName) => {
    return updatedFields.includes(fieldName);
  };

  const validateAddress = async () => {
    const fullAddress = `${formData.address.line1 || ''}${formData.address.line2 ? ', ' + formData.address.line2 : ''}, ${formData.address.city || ''}, ${formData.address.state || ''} ${formData.address.pincode || ''}, ${formData.address.country || 'India'}`;
    
    if (!formData.address.line1 && !formData.address.city && !formData.address.state && !formData.address.pincode) {
      setAddressValidation({
        isValid: false,
        suggestions: [],
        loading: false
      });
      toast.error('Please enter at least some address information to validate');
      return;
    }

    try {
      setAddressValidation(prev => ({ ...prev, loading: true }));
      
      const response = await fetch(`/api/maps/geocode-enhanced?address=${encodeURIComponent(fullAddress)}`);
      
      if (response.ok) {
        const data = await response.json();
        setAddressValidation({
          isValid: true,
          suggestions: [{
            address: data.address,
            confidence: data.confidence,
            coordinates: data.coordinates
          }],
          loading: false
        });
        
        // Auto-set location if confidence is high
        if (data.confidence > 0.7) {
          setLocation({
            coordinates: data.coordinates,
            address: data.address,
            confidence: data.confidence,
            source: 'geocoded'
          });
        }
      } else {
        setAddressValidation({
          isValid: false,
          suggestions: [],
          loading: false
        });
      }
    } catch (error) {
      console.error('Address validation error:', error);
      setAddressValidation({
        isValid: false,
        suggestions: [],
        loading: false
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Business Profile</h1>
          <p className="text-gray-600 mt-1">Manage your business information and location</p>
        </div>
        {!isEditing && businessProfile && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg font-medium flex items-center transition-colors"
          >
            <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Profile
          </button>
        )}
      </div>

      {/* Profile Form */}
      <form onSubmit={saveBusinessProfile} className="space-y-6" noValidate>
        <div className="bg-white rounded-lg shadow-sm border border-yellow-200 overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 px-6 py-8">
            <div className="flex items-center">
              <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                {formData.profileIcon ? (
                  <img
                    src={formData.profileIcon}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <svg className="h-10 w-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-6 text-white">
                <h2 className="text-2xl font-bold">{formData.companyName || 'Company Name'}</h2>
                <p className="text-yellow-100 text-lg">{formData.ownerName || 'Owner Name'}</p>
                {formData.address.city && (
                  <p className="text-yellow-200 text-sm mt-1">
                    {formData.address.city}, {formData.address.state}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-6">
            {/* Profile Icon Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Icon
              </label>
              <div className="flex items-center space-x-4">
                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {formData.profileIcon ? (
                    <img
                      src={formData.profileIcon}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <input
                  ref={profileIconRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'profileIcon')}
                  className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                />
              </div>
            </div>

            {/* Company Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
                  placeholder="Email address"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Enter contact number"
                  />
                </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Enter company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Owner Name
                </label>
                <input
                  type="text"
                  name="ownerName"
                  value={formData.ownerName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder="Enter owner name"
                />
              </div>
            </div>

            {/* PAN Card Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PAN Card Information
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PAN Card Image
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="h-16 w-16 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden">
                      {formData.panCardImage ? (
                        <img
                          src={formData.panCardImage}
                          alt="PAN Card"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <input
                      ref={panCardImageRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'panCardImage')}
                      className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-yellow-700 hover:file:bg-yellow-100"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Upload a clear image of your PAN card. We'll automatically extract the PAN number.
                    <br />
                    <span className="text-yellow-600 font-medium">
                      Note: If auto-extraction fails, you can manually enter the PAN number below.
                    </span>
                  </p>
                  
                  {/* PAN Extraction Loading */}
                  {isExtractingPAN && (
                    <div className="mt-2 flex items-center text-yellow-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                      <span className="text-sm">Extracting PAN data...</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PAN Card Number
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      name="panCard"
                      value={formData.panCard}
                      onChange={handleInputChange}
                      className={`flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                        isFieldUpdated('PAN Card Number') 
                          ? 'border-green-500 bg-green-50 text-green-800' 
                          : 'border-gray-300'
                      }`}
                      placeholder="ABCDE1234F"
                      style={{ textTransform: 'uppercase' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        // Simple PAN format validation
                        const panValue = formData.panCard.toUpperCase();
                        const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
                        if (panRegex.test(panValue)) {
                          toast.success('PAN number format is valid!');
                        } else {
                          toast.error('Please enter a valid PAN number (e.g., ABCDE1234F)');
                        }
                      }}
                      className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 text-sm font-medium"
                    >
                      Validate
                    </button>
                  </div>
                  {isFieldUpdated('PAN Card Number') && (
                    <p className="text-xs text-green-600 mt-1">✓ Auto-extracted from image</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Format: 5 letters, 4 numbers, 1 letter (e.g., ABCDE1234F)
                  </p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1
                  </label>
                  <input
                    type="text"
                    name="address.line1"
                    value={formData.address.line1}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Street address"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    name="address.line2"
                    value={formData.address.line2}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Apartment, suite, etc. (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="address.city"
                    value={formData.address.city}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    name="address.state"
                    value={formData.address.state}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="State"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="address.pincode"
                    value={formData.address.pincode}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="123456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    name="address.country"
                    value={formData.address.country}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Country"
                  />
                </div>
              </div>

              {/* Address Validation */}
              <div className="mt-4">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={validateAddress}
                    disabled={addressValidation.loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
                  >
                    {addressValidation.loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Validating...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Validate Address
                      </>
                    )}
                  </button>
                  
                  {addressValidation.isValid !== null && (
                    <div className="flex items-center">
                      {addressValidation.isValid ? (
                        <div className="flex items-center text-green-600">
                          <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Valid Address</span>
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600">
                          <svg className="h-5 w-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm font-medium">Invalid Address</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {addressValidation.suggestions.length > 0 && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h6 className="text-sm font-medium text-blue-900 mb-2">Address Suggestions</h6>
                    {addressValidation.suggestions.map((suggestion, index) => (
                      <div key={index} className="text-sm text-blue-800">
                        <p><strong>Suggested:</strong> {suggestion.address}</p>
                        <p><strong>Confidence:</strong> {Math.round(suggestion.confidence * 100)}%</p>
                        {suggestion.confidence > 0.7 && (
                          <p className="text-green-600 font-medium">✓ High confidence - location auto-set</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Location Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Business Location
              </h3>
              
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:bg-gray-400 flex items-center"
                  >
                    {locationLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Getting Location...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Use Current Location
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={geocodeAddress}
                    disabled={locationLoading}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:bg-gray-400 flex items-center"
                  >
                    {locationLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Finding...
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Find from Address
                      </>
                    )}
                  </button>

                  {location.coordinates && (
                    <button
                      type="button"
                      onClick={clearLocation}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center"
                    >
                      <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear Location
                    </button>
                  )}
                </div>

                {location.coordinates && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h5 className="text-sm font-medium text-yellow-900 mb-2">Selected Location</h5>
                    <div className="space-y-2">
                      <p className="text-sm text-yellow-800">
                        <strong>Coordinates:</strong> {location.coordinates.lat.toFixed(6)}, {location.coordinates.lng.toFixed(6)}
                      </p>
                      {location.address && (
                        <p className="text-sm text-yellow-800">
                          <strong>Address:</strong> {location.address}
                        </p>
                      )}
                      {location.confidence && (
                        <p className="text-sm text-yellow-800">
                          <strong>Confidence:</strong> {Math.round(location.confidence * 100)}%
                        </p>
                      )}
                      {location.source && (
                        <p className="text-sm text-yellow-800">
                          <strong>Source:</strong> {location.source === 'geocoded' ? 'Auto-detected' : 'Manual selection'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 text-sm text-gray-600 border-b">
                    Click on the map to set your business location
                  </div>
                  {mapError ? (
                    <div className="h-64 w-full bg-gray-100 flex items-center justify-center">
                      <div className="text-center">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <p className="mt-2 text-sm text-gray-600">Map failed to load</p>
                        <button 
                          onClick={() => {
                            setMapError(false);
                            setMap(null);
                          }}
                          className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      ref={mapRef} 
                      className="h-64 w-full"
                      style={{ 
                        minHeight: '256px',
                        zIndex: 1
                      }}
                    ></div>
                  )}
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-end space-x-3 pt-6 border-t">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 rounded-md flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
