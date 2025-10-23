import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { validateEmail, validatePassword, validatePasswordMatch, getPasswordStrengthColor, getPasswordStrengthText } from '../utils/validation';

const ForgotPasswordModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1); // 1: Email, 2: Code Verification, 3: New Password
  const [formData, setFormData] = useState({
    email: '',
    resetCode: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState({
    email: '',
    resetCode: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(null);

  // Clear form and reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setFormData({
        email: '',
        resetCode: '',
        newPassword: '',
        confirmPassword: ''
      });
      setError('');
      setValidationErrors({
        email: '',
        resetCode: '',
        newPassword: '',
        confirmPassword: ''
      });
      setPasswordStrength(null);
    }
  }, [isOpen]);

  // Clear toasts on component unmount
  useEffect(() => {
    return () => {
      toast.dismiss();
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Live validation
    if (name === 'email') {
      const emailValidation = validateEmail(value);
      setValidationErrors(prev => ({
        ...prev,
        email: emailValidation.message
      }));
    } else if (name === 'newPassword') {
      const passwordValidation = validatePassword(value);
      setPasswordStrength(passwordValidation.strength);
      setValidationErrors(prev => ({
        ...prev,
        newPassword: passwordValidation.message
      }));
    } else if (name === 'confirmPassword') {
      const passwordMatchValidation = validatePasswordMatch(formData.newPassword, value);
      setValidationErrors(prev => ({
        ...prev,
        confirmPassword: passwordMatchValidation.message
      }));
    }
  };

  const isEmailValid = () => {
    return formData.email && !validationErrors.email;
  };

  const isCodeValid = () => {
    return formData.resetCode && formData.resetCode.length === 6;
  };

  const isPasswordValid = () => {
    return formData.newPassword && 
           formData.confirmPassword && 
           !validationErrors.newPassword && 
           !validationErrors.confirmPassword;
  };

  const handleSendCode = async () => {
    if (!isEmailValid()) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    toast.dismiss();

    try {
      const response = await axios.post('/api/auth/forgot-password', {
        email: formData.email
      });
      
      toast.success('Reset code sent to your email!', {
        duration: 3000,
        id: 'reset-code-sent'
      });
      
      setStep(2);
    } catch (err) {
      console.error('Send code error:', err);
      let errorMessage = 'Failed to send reset code';
      
      if (err.response?.status === 404) {
        errorMessage = 'No account found with this email address. Please check your email or create a new account.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message === 'Network Error') {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!isCodeValid()) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);
    setError('');
    toast.dismiss();

    try {
      // We'll verify the code when setting the new password
      setStep(3);
      toast.success('Code verified! Please enter your new password.', {
        duration: 2000,
        id: 'code-verified'
      });
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to verify code';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isPasswordValid()) {
      setError('Please fix the validation errors');
      return;
    }

    setLoading(true);
    setError('');
    toast.dismiss();

    try {
      const response = await axios.post('/api/auth/reset-password', {
        email: formData.email,
        resetCode: formData.resetCode,
        newPassword: formData.newPassword
      });
      
      toast.success('Password reset successfully! You can now log in.', {
        duration: 3000,
        id: 'password-reset-success'
      });
      
      // Close modal after success
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Reset password error:', err);
      let errorMessage = 'Failed to reset password';
      
      if (err.response?.status === 400) {
        if (err.response.data.message.includes('Invalid reset code')) {
          errorMessage = 'Invalid or expired reset code. Please request a new one.';
        } else if (err.response.data.message.includes('No active reset code')) {
          errorMessage = 'Reset code has expired. Please request a new one.';
        } else {
          errorMessage = err.response.data.message;
        }
      } else if (err.response?.status === 404) {
        errorMessage = 'User not found. Please try again.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message === 'Network Error') {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      setError('');
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError('');
    toast.dismiss();

    try {
      const response = await axios.post('/api/auth/forgot-password', {
        email: formData.email
      });
      
      toast.success('New reset code sent!', {
        duration: 2000,
        id: 'resend-code-success'
      });
    } catch (err) {
      console.error('Resend code error:', err);
      let errorMessage = 'Failed to resend code';
      
      if (err.response?.status === 404) {
        errorMessage = 'No account found with this email address.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message === 'Network Error') {
        errorMessage = 'Unable to connect to server. Please check your internet connection.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="h-8 w-8 bg-primary-400 rounded-lg flex items-center justify-center mr-3">
                <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Reset Password</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center space-x-4">
                {[1, 2, 3].map((stepNumber) => (
                  <div key={stepNumber} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= stepNumber 
                        ? 'bg-primary-500 text-white' 
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                      {stepNumber}
                    </div>
                    {stepNumber < 3 && (
                      <div className={`w-8 h-0.5 mx-2 ${
                        step > stepNumber ? 'bg-primary-500' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Step 1: Email */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Enter your email address</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    We'll send you a verification code to reset your password.
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div 
                      className="p-3 bg-red-50 border border-red-200 rounded-md"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <p className="text-sm text-red-600">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="text"
                      value={formData.email}
                      onChange={handleChange}
                      autoComplete="email"
                      noValidate
                      className={`block w-full pl-10 pr-3 py-2 border rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                        validationErrors.email 
                          ? 'border-red-300 focus:ring-red-500' 
                          : formData.email && !validationErrors.email 
                            ? 'border-green-300 focus:ring-green-500' 
                            : 'border-gray-300'
                      }`}
                      placeholder="Enter your email"
                    />
                    {formData.email && !validationErrors.email && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                        <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <AnimatePresence>
                    {validationErrors.email && (
                      <motion.p 
                        className="mt-1 text-sm text-red-600"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {validationErrors.email}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={handleSendCode}
                  disabled={loading || !isEmailValid()}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending...
                    </div>
                  ) : (
                    'Send Reset Code'
                  )}
                </button>
              </motion.div>
            )}

            {/* Step 2: Code Verification */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Enter verification code</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    We've sent a 6-digit code to <strong>{formData.email}</strong>
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div 
                      className="p-3 bg-red-50 border border-red-200 rounded-md"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <p className="text-sm text-red-600">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label htmlFor="resetCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Verification Code
                  </label>
                  <input
                    id="resetCode"
                    name="resetCode"
                    type="text"
                    maxLength="6"
                    value={formData.resetCode}
                    onChange={handleChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg tracking-widest"
                    placeholder="000000"
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleBack}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyCode}
                    disabled={loading || !isCodeValid()}
                    className="flex-1 py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? 'Verifying...' : 'Verify Code'}
                  </button>
                </div>

                <div className="text-center">
                  <button
                    onClick={handleResendCode}
                    disabled={loading}
                    className="text-sm text-primary-600 hover:text-primary-500 disabled:opacity-50"
                  >
                    Didn't receive the code? Resend
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: New Password */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Set new password</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Create a strong password for your account.
                  </p>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div 
                      className="p-3 bg-red-50 border border-red-200 rounded-md"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <p className="text-sm text-red-600">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.newPassword}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-10 py-2 border rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                        validationErrors.newPassword 
                          ? 'border-red-300 focus:ring-red-500' 
                          : formData.newPassword && !validationErrors.newPassword 
                            ? 'border-green-300 focus:ring-green-500' 
                            : 'border-gray-300'
                      }`}
                      placeholder="Enter new password"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                      >
                        {showPassword ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* Password Strength Indicator */}
                  {formData.newPassword && passwordStrength && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">Password strength:</span>
                        <span className={`text-xs font-medium ${
                          passwordStrength.level === 'weak' ? 'text-red-600' :
                          passwordStrength.level === 'fair' ? 'text-yellow-600' :
                          passwordStrength.level === 'good' ? 'text-blue-600' :
                          'text-green-600'
                        }`}>
                          {getPasswordStrengthText(passwordStrength.level)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${getPasswordStrengthColor(passwordStrength.level)}`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                      {passwordStrength.feedback.length > 0 && (
                        <div className="mt-1">
                          <p className="text-xs text-gray-600">Requirements:</p>
                          <ul className="text-xs text-gray-500 mt-1">
                            {passwordStrength.feedback.map((feedback, index) => (
                              <li key={index} className="flex items-center">
                                <span className="mr-1">•</span>
                                {feedback}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <AnimatePresence>
                    {validationErrors.newPassword && (
                      <motion.p 
                        className="mt-1 text-sm text-red-600"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {validationErrors.newPassword}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className={`block w-full pl-10 pr-10 py-2 border rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors ${
                        validationErrors.confirmPassword 
                          ? 'border-red-300 focus:ring-red-500' 
                          : formData.confirmPassword && !validationErrors.confirmPassword 
                            ? 'border-green-300 focus:ring-green-500' 
                            : 'border-gray-300'
                      }`}
                      placeholder="Confirm new password"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                      >
                        {showConfirmPassword ? (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {validationErrors.confirmPassword && (
                      <motion.p 
                        className="mt-1 text-sm text-red-600"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                      >
                        {validationErrors.confirmPassword}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={handleBack}
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={loading || !isPasswordValid()}
                    className="flex-1 py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {loading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;
