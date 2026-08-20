const {
  validatePassword,
  generateStrongPassword,
  getStrengthColor
} = require('../utils/passwordValidator');

describe('validatePassword', () => {
  test('accepts a strong password', () => {
    const result = validatePassword('Str0ng!Passw0rd');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects passwords shorter than 8 characters', () => {
    const result = validatePassword('Ab1!def');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  test('rejects passwords without an uppercase letter', () => {
    const result = validatePassword('weakpass1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  test('rejects passwords without a lowercase letter', () => {
    const result = validatePassword('WEAKPASS1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  test('rejects passwords without a number', () => {
    const result = validatePassword('WeakPass!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  test('rejects passwords without a special character', () => {
    const result = validatePassword('WeakPass1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  });

  test('rejects common passwords case-insensitively', () => {
    const result = validatePassword('Password123');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password is too common. Please choose a more unique password');
  });

  test('rejects passwords with sequential characters', () => {
    const result = validatePassword('Abc12345!x');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password contains sequential characters which are not allowed');
  });

  test('rejects passwords with repeated characters', () => {
    const result = validatePassword('Abbb1!xyzZ');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password contains too many repeated characters');
  });

  test('classifies weak passwords', () => {
    const result = validatePassword('short');
    expect(result.strength).toBe('weak');
  });

  test('classifies medium passwords', () => {
    const result = validatePassword('Abc12!x');
    expect(result.strength).toBe('medium');
  });

  test('classifies strong passwords', () => {
    const result = validatePassword('Str0ng!Passw0rd');
    expect(result.strength).toBe('strong');
  });
});

describe('generateStrongPassword', () => {
  test('generates a password of at least 12 characters', () => {
    expect(generateStrongPassword().length).toBeGreaterThanOrEqual(12);
  });

  test('includes at least one uppercase, lowercase, number and special character', () => {
    const password = generateStrongPassword();
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/);
  });
});

describe('getStrengthColor', () => {
  test('maps strength levels to colors', () => {
    expect(getStrengthColor('strong')).toBe('#28a745');
    expect(getStrengthColor('medium')).toBe('#ffc107');
    expect(getStrengthColor('weak')).toBe('#dc3545');
  });
});