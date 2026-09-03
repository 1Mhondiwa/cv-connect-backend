// tests/envValidator.test.js — unit tests for startup environment validation
const { validateEnv, REQUIRED_VARS, FEATURE_VARS } = require('../utils/envValidator');

const fullEnv = () => ({
  DB_HOST: 'db.example.com',
  DB_NAME: 'postgres',
  DB_USER: 'postgres',
  DB_PASSWORD: 'secret',
  JWT_SECRET: 'jwt-secret',
  ADMIN_SECRET_KEY: 'admin-key',
  ECS_EMPLOYEE_SECRET_KEY: 'ecs-key',
  EMAIL_USER: 'ops@example.com',
  EMAIL_PASS: 'mail-pass',
});

describe('validateEnv', () => {
  test('passes with a complete environment and no warnings', () => {
    const { warnings } = validateEnv(fullEnv());
    expect(warnings).toEqual([]);
  });

  test.each(REQUIRED_VARS)('throws when required var %s is missing', (name) => {
    const env = fullEnv();
    delete env[name];
    expect(() => validateEnv(env)).toThrow(name);
  });

  test('lists every missing required variable in one error', () => {
    expect(() => validateEnv({})).toThrow('DB_HOST');
    expect(() => validateEnv({})).toThrow('JWT_SECRET');
    expect(() => validateEnv({})).toThrow('.env.example');
  });

  test.each([
    ['DB_HOST', ''],
    ['DB_PASSWORD', '   '],
    ['JWT_SECRET', null],
  ])('treats %s=%p as missing', (name, value) => {
    const env = fullEnv();
    env[name] = value;
    expect(() => validateEnv(env)).toThrow(name);
  });

  test('warns for each degraded feature without throwing', () => {
    const env = fullEnv();
    delete env.ADMIN_SECRET_KEY;
    delete env.EMAIL_USER;
    delete env.EMAIL_PASS;

    const { warnings } = validateEnv(env);

    expect(warnings).toHaveLength(3);
    expect(warnings.join(' ')).toContain('admin account creation');
    expect(warnings.join(' ')).toContain('password reset emails');
  });

  test('exports the variable lists for documentation', () => {
    expect(REQUIRED_VARS).toContain('JWT_SECRET');
    expect(FEATURE_VARS.map((f) => f.name)).toContain('EMAIL_USER');
  });
});
