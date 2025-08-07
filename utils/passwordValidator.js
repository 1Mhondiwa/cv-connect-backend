// utils/passwordValidator.js

/**
 * Strong password validation utility
 * Requirements:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 * - No common passwords
 * - No sequential characters (123, abc, etc.)
 */

const commonPasswords = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  'admin', 'letmein', 'welcome', 'monkey', 'dragon', 'master', 'hello',
  'freedom', 'whatever', 'qazwsx', 'trustno1', 'jordan', 'harley',
  'ranger', 'iwantu', 'jennifer', 'hunter', 'joshua', 'maggie',
  'guitar', 'spencer', 'debbie', 'diamond', 'melissa', 'matthew',
  'steelers', 'tiger', 'charles', 'butter', 'mickey', 'cooper',
  'scooter', 'richard', 'tucker', 'jordan23', 'zxcvbnm', 'asdfgh',
  'liverpool', 'chelsea', 'arsenal', 'manchester', 'barcelona',
  'real madrid', 'bayern', 'juventus', 'milan', 'inter', 'roma',
  'napoli', 'lazio', 'fiorentina', 'torino', 'genoa', 'sampdoria',
  'udinese', 'atalanta', 'sassuolo', 'bologna', 'cagliari', 'empoli',
  'lecce', 'salernitana', 'monza', 'cremonese', 'spezia', 'verona'
];

/**
 * Validates password strength
 * @param {string} password - The password to validate
 * @returns {object} - Validation result with details
 */
const validatePassword = (password) => {
  const result = {
    isValid: false,
    errors: [],
    strength: 'weak',
    score: 0
  };

  // Check minimum length
  if (password.length < 8) {
    result.errors.push('Password must be at least 8 characters long');
  } else {
    result.score += 1;
  }

  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    result.errors.push('Password must contain at least one uppercase letter');
  } else {
    result.score += 1;
  }

  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    result.errors.push('Password must contain at least one lowercase letter');
  } else {
    result.score += 1;
  }

  // Check for numbers
  if (!/\d/.test(password)) {
    result.errors.push('Password must contain at least one number');
  } else {
    result.score += 1;
  }

  // Check for special characters
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    result.errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  } else {
    result.score += 1;
  }

  // Check for common passwords
  if (commonPasswords.includes(password.toLowerCase())) {
    result.errors.push('Password is too common. Please choose a more unique password');
  } else {
    result.score += 1;
  }

  // Check for sequential characters (3 or more)
  const sequentialPatterns = [
    '123', '234', '345', '456', '567', '678', '789', '012',
    'abc', 'bcd', 'cde', 'def', 'efg', 'fgh', 'ghi', 'hij',
    'qwe', 'wer', 'ert', 'rty', 'tyu', 'yui', 'uio', 'iop',
    'asd', 'sdf', 'dfg', 'fgh', 'ghj', 'hjk', 'jkl', 'klz',
    'zxc', 'xcv', 'cvb', 'vbn', 'bnm'
  ];

  const hasSequential = sequentialPatterns.some(pattern => 
    password.toLowerCase().includes(pattern)
  );

  if (hasSequential) {
    result.errors.push('Password contains sequential characters which are not allowed');
  } else {
    result.score += 1;
  }

  // Check for repeated characters (3 or more)
  if (/(.)\1{2,}/.test(password)) {
    result.errors.push('Password contains too many repeated characters');
  } else {
    result.score += 1;
  }

  // Determine strength based on score
  if (result.score >= 7) {
    result.strength = 'strong';
  } else if (result.score >= 5) {
    result.strength = 'medium';
  } else {
    result.strength = 'weak';
  }

  // Password is valid if no errors
  result.isValid = result.errors.length === 0;

  return result;
};

/**
 * Generates a strong password suggestion
 * @returns {string} - A strong password suggestion
 */
const generateStrongPassword = () => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  
  let password = '';
  
  // Ensure at least one of each required character type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Fill the rest with random characters
  const allChars = uppercase + lowercase + numbers + symbols;
  for (let i = 4; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Gets password strength color for UI
 * @param {string} strength - Password strength
 * @returns {string} - CSS color
 */
const getStrengthColor = (strength) => {
  switch (strength) {
    case 'strong':
      return '#28a745';
    case 'medium':
      return '#ffc107';
    case 'weak':
      return '#dc3545';
    default:
      return '#6c757d';
  }
};

module.exports = {
  validatePassword,
  generateStrongPassword,
  getStrengthColor
};
