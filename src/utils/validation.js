// Validation utility functions

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    isValid: emailRegex.test(email),
    message: emailRegex.test(email) ? '' : 'Please enter a valid email address'
  };
};

export const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const strength = {
    score: 0,
    feedback: [],
    level: 'weak'
  };

  if (password.length >= minLength) {
    strength.score += 1;
  } else {
    strength.feedback.push(`At least ${minLength} characters`);
  }

  if (hasUpperCase) {
    strength.score += 1;
  } else {
    strength.feedback.push('One uppercase letter');
  }

  if (hasLowerCase) {
    strength.score += 1;
  } else {
    strength.feedback.push('One lowercase letter');
  }

  if (hasNumbers) {
    strength.score += 1;
  } else {
    strength.feedback.push('One number');
  }

  if (hasSpecialChar) {
    strength.score += 1;
  } else {
    strength.feedback.push('One special character');
  }

  // Determine strength level
  if (strength.score <= 2) {
    strength.level = 'weak';
  } else if (strength.score <= 3) {
    strength.level = 'fair';
  } else if (strength.score <= 4) {
    strength.level = 'good';
  } else {
    strength.level = 'strong';
  }

  return {
    isValid: strength.score >= 3,
    strength,
    message: strength.score >= 3 ? '' : 'Password must meet minimum requirements'
  };
};

export const validatePasswordMatch = (password, confirmPassword) => {
  return {
    isValid: password === confirmPassword,
    message: password === confirmPassword ? '' : 'Passwords do not match'
  };
};

export const validateRole = (role) => {
  const validRoles = ['business', 'customer', 'driver'];
  return {
    isValid: validRoles.includes(role),
    message: validRoles.includes(role) ? '' : 'Please select a valid role'
  };
};

export const getPasswordStrengthColor = (level) => {
  switch (level) {
    case 'weak':
      return 'bg-red-500';
    case 'fair':
      return 'bg-yellow-500';
    case 'good':
      return 'bg-blue-500';
    case 'strong':
      return 'bg-green-500';
    default:
      return 'bg-gray-300';
  }
};

export const getPasswordStrengthText = (level) => {
  switch (level) {
    case 'weak':
      return 'Weak';
    case 'fair':
      return 'Fair';
    case 'good':
      return 'Good';
    case 'strong':
      return 'Strong';
    default:
      return '';
  }
};

