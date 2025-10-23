import { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import ProfilePage from './driver/ProfilePage';
import JobOffersPage from './driver/JobOffersPage';

const DriverDashboard = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [driverProfile, setDriverProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [profileForm, setProfileForm] = useState({
    dlNumber: '',
    dlIssueDate: '',
    dlValidity: '',
    name: '',
    dateOfBirth: '',
    bloodGroup: '',
    permanentAddress: '',
    vehicleClass: []
  });
  const [licenseImages, setLicenseImages] = useState({
    front: null,
    back: null
  });
  const [jobOffers, setJobOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const handleLogout = () => {
    onLogout();
  };

  // Load driver profile on component mount
  useEffect(() => {
    loadDriverProfile();
  }, []);

  // Load job offers when offers tab is active
  useEffect(() => {
    if (activeTab === 'offers') {
      loadJobOffers();
    }
  }, [activeTab]);

  const loadDriverProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/drivers/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDriverProfile(data.driver);
        if (data.driver) {
          setProfileForm({
            dlNumber: data.driver.dlNumber || '',
            dlIssueDate: data.driver.dlIssueDate ? new Date(data.driver.dlIssueDate).toISOString().split('T')[0] : '',
            dlValidity: data.driver.dlValidity ? new Date(data.driver.dlValidity).toISOString().split('T')[0] : '',
            name: data.driver.name || '',
            dateOfBirth: data.driver.dateOfBirth ? new Date(data.driver.dateOfBirth).toISOString().split('T')[0] : '',
            bloodGroup: data.driver.bloodGroup || '',
            permanentAddress: data.driver.permanentAddress || '',
            vehicleClass: data.driver.vehicleClass || []
          });
        }
      }
    } catch (error) {
      console.error('Error loading driver profile:', error);
    }
  };

  const loadJobOffers = async () => {
    try {
      setOffersLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/job-offers/driver', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Job offers response:', data);
        console.log('Job offers data:', data.jobOffers);
        setJobOffers(data.jobOffers || []);
      } else {
        console.error('Failed to load job offers:', response.status);
        toast.error('Failed to load job offers');
      }
    } catch (error) {
      console.error('Error loading job offers:', error);
      toast.error('Error loading job offers');
    } finally {
      setOffersLoading(false);
    }
  };

  const respondToOffer = async (offerId, status) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/job-offers/${offerId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (response.ok) {
        toast.success(`Job offer ${status} successfully!`);
        loadJobOffers(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || `Failed to ${status} offer`);
      }
    } catch (error) {
      console.error(`Error ${status}ing offer:`, error);
      toast.error(`Error ${status}ing offer`);
    }
  };

  const handleImageUpload = (side, file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target.result;
      setLicenseImages(prev => ({
        ...prev,
        [side]: imageData
      }));
      
      // Automatically extract data when image is uploaded
      await extractLicenseInfo(side, imageData);
    };
    reader.readAsDataURL(file);
  };

  const extractLicenseInfo = async (side, imageData = null) => {
    const imageToUse = imageData || licenseImages[side];
    if (!imageToUse) {
      alert('Please upload an image first');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const base64Data = imageToUse.split(',')[1];
      
      const response = await fetch('/api/drivers/extract-license-info', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: 'image/jpeg',
          side: side
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const extractedData = data.data;
          
          if (side === 'front') {
            // Update form with front side data
            setProfileForm(prev => ({
              ...prev,
              dlNumber: extractedData.dlNumber !== 'Not Available' ? extractedData.dlNumber : prev.dlNumber,
              dlIssueDate: extractedData.dlIssueDate ? extractedData.dlIssueDate : prev.dlIssueDate,
              dlValidity: extractedData.dlValidity ? extractedData.dlValidity : prev.dlValidity,
              name: extractedData.name !== 'Not Available' ? extractedData.name : prev.name,
              dateOfBirth: extractedData.dateOfBirth ? extractedData.dateOfBirth : prev.dateOfBirth,
              bloodGroup: extractedData.bloodGroup !== 'Not Available' ? extractedData.bloodGroup : prev.bloodGroup,
              permanentAddress: extractedData.permanentAddress !== 'Not Available' ? extractedData.permanentAddress : prev.permanentAddress
            }));
            
            // Show success message with extracted fields
            const extractedFields = [];
            if (extractedData.dlNumber !== 'Not Available') extractedFields.push('DL Number');
            if (extractedData.name !== 'Not Available') extractedFields.push('Name');
            if (extractedData.dlIssueDate) extractedFields.push('Issue Date');
            if (extractedData.dlValidity) extractedFields.push('Validity');
            if (extractedData.dateOfBirth) extractedFields.push('Date of Birth');
            if (extractedData.bloodGroup !== 'Not Available') extractedFields.push('Blood Group');
            if (extractedData.permanentAddress !== 'Not Available') extractedFields.push('Address');
            
            console.log(`Front side extracted: ${extractedFields.join(', ')}`);
          } else {
            // Update form with back side data (vehicle class)
            const vehicleClasses = Array.isArray(extractedData.vehicleClass) ? extractedData.vehicleClass : [extractedData.vehicleClass];
            const validClasses = vehicleClasses.filter(cls => cls !== 'Not Available');
            
            if (validClasses.length > 0) {
              setProfileForm(prev => ({
                ...prev,
                vehicleClass: validClasses
              }));
              console.log(`Back side extracted: Vehicle Classes - ${validClasses.join(', ')}`);
            }
          }
        }
      } else {
        const errorData = await response.json();
        console.error(`Failed to extract information: ${errorData.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error extracting license info:', error);
      alert('Error extracting information from image');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitProfile = async (e) => {
    e.preventDefault();
    
    if (!licenseImages.front || !licenseImages.back) {
      alert('Please upload both front and back images of your driving license');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const frontBase64 = licenseImages.front.split(',')[1];
      const backBase64 = licenseImages.back.split(',')[1];

      const response = await fetch('/api/drivers/upload-license', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...profileForm,
          frontImageBase64: frontBase64,
          backImageBase64: backBase64
        })
      });

      if (response.ok) {
        const data = await response.json();
        alert('Profile updated successfully!');
        loadDriverProfile(); // Reload profile data
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white shadow-lg flex flex-col sticky top-0 h-screen">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-primary-400 rounded-lg flex items-center justify-center mr-3">
              <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 14H17a1 1 0 001-1V8a1 1 0 00-1-1h-3z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900">MobiTrak Driver</h1>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          {[
            { id: 'overview', name: 'Overview', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
            { id: 'profile', name: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
            { id: 'offers', name: 'Job Offers', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-500'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <svg className="h-5 w-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
              </svg>
              <span className="flex-1 text-left">{tab.name}</span>
              
              {/* Profile Warning Badge */}
              {tab.id === 'profile' && driverProfile && !driverProfile.profileCompleted && (
                <div className="flex items-center">
                  <div className="relative">
                    <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse"></div>
                  </div>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Driver Profile Section */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center mb-4">
            <div className="h-12 w-12 bg-gray-300 rounded-full flex items-center justify-center mr-3 overflow-hidden">
              {driverProfile?.profileIcon ? (
                <img
                  src={driverProfile.profileIcon}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg className="h-6 w-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {driverProfile?.name || 'Driver Name'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {driverProfile?.dlNumber || 'License Number'}
              </p>
              {driverProfile?.status && (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                  driverProfile.status === 'Hired' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {driverProfile.status}
                </span>
              )}
            </div>
          </div>

          {/* Profile Completion Warning */}
          {driverProfile && !driverProfile.profileCompleted && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <svg className="h-4 w-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <p className="text-xs text-yellow-800">
                  Complete your profile to receive job offers
                </p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className="flex-1 py-8 px-6">
          <div className="max-w-7xl mx-auto">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Driver Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-blue-900">Profile Status</h3>
                    <p className="text-blue-700">
                      {driverProfile?.profileCompleted ? 'Complete' : 'Incomplete'}
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-900">Job Offers</h3>
                    <p className="text-green-700">{jobOffers.length} available</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-purple-900">Driver Status</h3>
                    <p className="text-purple-700">{driverProfile?.status || 'Pending'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'profile' && (
            <ProfilePage 
              driverProfile={driverProfile}
              setDriverProfile={setDriverProfile}
              profileForm={profileForm}
              setProfileForm={setProfileForm}
              licenseImages={licenseImages}
              setLicenseImages={setLicenseImages}
              handleImageUpload={handleImageUpload}
              extractLicenseInfo={extractLicenseInfo}
              handleSubmitProfile={handleSubmitProfile}
              loading={loading}
            />
          )}
          {activeTab === 'offers' && (
            <JobOffersPage 
              jobOffers={jobOffers}
              offersLoading={offersLoading}
              respondToOffer={respondToOffer}
            />
          )}
          </div>
        </main>
      </div>

      <Toaster position="top-right" />
    </div>
  );
};

export default DriverDashboard;

