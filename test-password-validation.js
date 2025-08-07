const { validatePassword, generateStrongPassword } = require('./utils/passwordValidator');

console.log('Testing Strong Password Validation...\n');

// Test cases
const testPasswords = [
  'weak123',           // Too short, no uppercase, no special char
  'password',          // Common password
  '123456',           // Common password, sequential
  'abc123',           // Common password, sequential
  'Password123',      // Missing special char
  'password123!',     // Missing uppercase
  'PASSWORD123!',     // Missing lowercase
  'Password!',        // Missing number
  'Pass123',          // Too short
  'Password123!',     // Good password
  'MyStr0ng!P@ss',    // Strong password
  'Test123!@#',       // Strong password
  'aaa123!',          // Repeated characters
  'abc123!',          // Sequential characters
  generateStrongPassword() // Generated strong password
];

console.log('Testing password validation:');
console.log('='.repeat(50));

testPasswords.forEach((password, index) => {
  const result = validatePassword(password);
  const status = result.isValid ? '✅ VALID' : '❌ INVALID';
  
  console.log(`\n${index + 1}. Password: "${password}"`);
  console.log(`   Status: ${status}`);
  console.log(`   Strength: ${result.strength.toUpperCase()}`);
  console.log(`   Score: ${result.score}/8`);
  
  if (result.errors.length > 0) {
    console.log(`   Errors: ${result.errors.join(', ')}`);
  }
});

console.log('\n' + '='.repeat(50));
console.log('Testing password generation:');
console.log('='.repeat(50));

for (let i = 1; i <= 3; i++) {
  const generatedPassword = generateStrongPassword();
  const validation = validatePassword(generatedPassword);
  
  console.log(`\nGenerated Password ${i}: "${generatedPassword}"`);
  console.log(`   Valid: ${validation.isValid ? 'Yes' : 'No'}`);
  console.log(`   Strength: ${validation.strength.toUpperCase()}`);
  console.log(`   Score: ${validation.score}/8`);
}

console.log('\n✅ Password validation testing complete!');
