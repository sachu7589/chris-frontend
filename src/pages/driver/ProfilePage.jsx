import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const ProfilePage = ({ driverProfile, setDriverProfile, profileForm, setProfileForm, licenseImages, setLicenseImages, handleImageUpload, extractLicenseInfo, handleSubmitProfile, loading }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileIcon, setProfileIcon] = useState(null);
  const [address, setAddress] = useState({
    line1: '',
    line2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India'
  });
  const [showImageModal, setShowImageModal] = useState({ front: false, back: false });
  const [modalImage, setModalImage] = useState(null);
  const profileIconRef = useRef(null);

  // Initialize form data when driverProfile changes
  useEffect(() => {
    if (driverProfile) {
      setProfileIcon(driverProfile.profileIcon || null);
      setAddress(driverProfile.address || {
        line1: '',
        line2: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India'
      });
    }
  }, [driverProfile]);

  const handleProfileIconUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileIcon(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setAddress(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const saveDriverProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      // Check if we have license images - if not, we need to use the upload-license endpoint
      if (!licenseImages.front || !licenseImages.back) {
        toast.error('Please upload both front and back images of your driving license first');
        return;
      }

      // If we have license images, use the upload-license endpoint to create/update the profile
      const frontBase64 = licenseImages.front.split(',')[1];
      const backBase64 = licenseImages.back.split(',')[1];

      const profileData = {
        ...profileForm,
        frontImageBase64: frontBase64,
        backImageBase64: backBase64
      };
      
      console.log('Sending profile data with license images:', profileData);
      
      const response = await fetch('/api/drivers/upload-license', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Profile saved successfully:', data);
        setDriverProfile(data.driver);
        setIsEditing(false);
        toast.success('Driver profile saved successfully!');
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        toast.error('Error saving profile: ' + (errorData.message || 'Server error'));
      }
    } catch (error) {
      console.error('Error saving driver profile:', error);
      toast.error('Error saving driver profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateProfileDetails = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const profileData = {
        ...profileForm,
        profileIcon,
        address,
        // Include existing license images if they exist, otherwise use null
        frontImageBase64: licenseImages.front ? licenseImages.front.split(',')[1] : null,
        backImageBase64: licenseImages.back ? licenseImages.back.split(',')[1] : null
      };
      
      console.log('Sending profile update data:', profileData);
      console.log('Profile Icon data:', profileIcon);
      console.log('Address data:', address);
      
      // Use the upload-license endpoint for all profile updates to ensure consistency
      const response = await fetch('/api/drivers/upload-license', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(profileData)
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Profile updated successfully:', data);
        setDriverProfile(data.driver);
        setIsEditing(false);
        toast.success('Driver profile updated successfully!');
      } else {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        toast.error('Error updating profile: ' + (errorData.message || 'Server error'));
      }
    } catch (error) {
      console.error('Error updating driver profile:', error);
      toast.error('Error updating driver profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    
    // If profile is already completed, use updateProfileDetails
    if (driverProfile && driverProfile.profileCompleted) {
      await updateProfileDetails();
    } else {
      // If profile is not completed, use saveDriverProfile (with license images)
      await saveDriverProfile(e);
    }
  };

  const handleImageClick = (type, imageSrc) => {
    setModalImage(imageSrc);
    setShowImageModal(prev => ({ ...prev, [type]: true }));
  };

  const closeImageModal = () => {
    setShowImageModal({ front: false, back: false });
    setModalImage(null);
  };

  const removeImage = (type) => {
    setLicenseImages(prev => ({ ...prev, [type]: null }));
    toast.success(`${type === 'front' ? 'Front' : 'Back'} license image removed`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Driver Profile</h2>
        <p className="text-gray-600 mt-1">Manage your personal information and address</p>
      </div>
      
      {/* Profile Status */}
      {driverProfile && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Profile Status</h3>
              <p className="text-sm text-gray-500">
                {driverProfile.profileCompleted ? 'Profile Completed' : 'Profile Incomplete'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                driverProfile.status === 'Hired' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {driverProfile.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Profile Completion Prompt */}
      {driverProfile && !driverProfile.profileCompleted && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-medium text-yellow-800">Complete Your Profile</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Your profile is incomplete. Please fill out all the required information below to:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Make yourself visible to businesses</li>
                  <li>Receive job offers</li>
                  <li>Complete your driver verification</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Driver Profile Form */}
      <form onSubmit={handleFormSubmit} className="space-y-6" noValidate>
        <div className="bg-white rounded-lg shadow-sm border border-primary-200 overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 px-6 py-8">
            <div className="flex items-center">
              <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center overflow-hidden shadow-lg">
                {profileIcon ? (
                  <img
                    src={profileIcon}
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
                <h2 className="text-2xl font-bold">{profileForm.name || 'Driver Name'}</h2>
                <p className="text-primary-100 text-lg">{profileForm.dlNumber || 'License Number'}</p>
                {address.city && (
                  <p className="text-primary-200 text-sm mt-1">
                    {address.city}, {address.state}
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
                  {profileIcon ? (
                    <img
                      src={profileIcon}
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
                  onChange={handleProfileIconUpload}
                  className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>
            </div>

            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={profileForm.dateOfBirth}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Group
                  </label>
                  <input
                    type="text"
                    value={profileForm.bloodGroup}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, bloodGroup: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Blood Group (e.g., A+, B-, O+)"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vehicle Classes
                  </label>
                  <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    {profileForm.vehicleClass.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {profileForm.vehicleClass.map((cls, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-500">Vehicle classes will be extracted from license back</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Driving License Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Driving License Information
              </h3>
              
              {/* License Images Upload */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Front Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driving License Front
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {licenseImages.front ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <img 
                            src={licenseImages.front} 
                            alt="License Front" 
                            className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => handleImageClick('front', licenseImages.front)}
                          />
                          <button
                            onClick={() => removeImage('front')}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                            title="Remove image"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {loading && (
                          <div className="text-center text-sm text-blue-600">
                            Extracting data automatically...
                          </div>
                        )}
                        <div className="text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload('front', e.target.files[0])}
                            className="hidden"
                            id="front-upload-new"
                          />
                          <label
                            htmlFor="front-upload-new"
                            className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            Upload different image
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload('front', e.target.files[0])}
                          className="hidden"
                          id="front-upload"
                        />
                        <label
                          htmlFor="front-upload"
                          className="cursor-pointer text-gray-500 hover:text-gray-700"
                        >
                          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <p className="mt-2 text-sm">Click to upload front image</p>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Back Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Driving License Back
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                    {licenseImages.back ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <img 
                            src={licenseImages.back} 
                            alt="License Back" 
                            className="w-full h-32 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => handleImageClick('back', licenseImages.back)}
                          />
                          <button
                            onClick={() => removeImage('back')}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                            title="Remove image"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        {loading && (
                          <div className="text-center text-sm text-blue-600">
                            Extracting vehicle class...
                          </div>
                        )}
                        <div className="text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload('back', e.target.files[0])}
                            className="hidden"
                            id="back-upload-new"
                          />
                          <label
                            htmlFor="back-upload-new"
                            className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 underline"
                          >
                            Upload different image
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload('back', e.target.files[0])}
                          className="hidden"
                          id="back-upload"
                        />
                        <label
                          htmlFor="back-upload"
                          className="cursor-pointer text-gray-500 hover:text-gray-700"
                        >
                          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <p className="mt-2 text-sm">Click to upload back image</p>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* License Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Driving License Number
                  </label>
                  <input
                    type="text"
                    value={profileForm.dlNumber}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, dlNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={profileForm.dlIssueDate}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, dlIssueDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Validity Date
                  </label>
                  <input
                    type="date"
                    value={profileForm.dlValidity}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, dlValidity: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Permanent Address
                  </label>
                  <textarea
                    value={profileForm.permanentAddress}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, permanentAddress: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="h-5 w-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Current Address
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={address.city}
                    onChange={handleAddressChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="City"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    name="state"
                    value={address.state}
                    onChange={handleAddressChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="State"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pincode
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={address.pincode}
                    onChange={handleAddressChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="123456"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    name="country"
                    value={address.country}
                    onChange={handleAddressChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Country"
                  />
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
                className="px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 rounded-md flex items-center"
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

      {/* Image Modal */}
      {(showImageModal.front || showImageModal.back) && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={closeImageModal}>
          <div className="relative max-w-4xl max-h-full p-4">
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 bg-white hover:bg-gray-100 text-gray-800 rounded-full p-2 z-10 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={modalImage}
              alt="License Image"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
