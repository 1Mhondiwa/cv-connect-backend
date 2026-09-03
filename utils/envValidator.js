// utils/envValidator.js

// Variables without which the server cannot function at all.
const REQUIRED_VARS = [
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
  'JWT_SECRET',
];

// Variables whose absence silently degrades a feature. The server can boot
// without them, but the operator should know what will not work.
const FEATURE_VARS = [
  { name: 'ADMIN_SECRET_KEY', feature: 'admin account creation' },
  { name: 'ECS_EMPLOYEE_SECRET_KEY', feature: 'ECS employee account creation' },
  { name: 'EMAIL_USER', feature: 'password reset emails' },
  { name: 'EMAIL_PASS', feature: 'password reset emails' },
];

const isMissing = (value) => value === undefined || value === null || String(value).trim() === '';

/**
 * Validates the process environment before the server boots.
 * @returns {{ warnings: string[] }} warning messages for degraded features
 * @throws {Error} listing every missing required variable
 */
function validateEnv(env = process.env) {
  const missing = REQUIRED_VARS.filter((name) => isMissing(env[name]));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill in the values before starting the server.'
    );
  }

  const warnings = [];
  for (const { name, feature } of FEATURE_VARS) {
    if (isMissing(env[name])) {
      warnings.push(`${name} is not set — ${feature} will not work`);
    }
  }

  return { warnings };
}

module.exports = { validateEnv, REQUIRED_VARS, FEATURE_VARS };
