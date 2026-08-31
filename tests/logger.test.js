// tests/logger.test.js — unit tests for the logging utility
// The logger is a singleton created at import time, so LOG_LEVEL /
// NODE_ENV are set before require via jest configuration in each describe.

describe('logger level gating', () => {
  let logger;

  const loadLogger = () => {
    let resolved;
    jest.isolateModules(() => {
      resolved = require('../utils/logger');
    });
    return resolved;
  };

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'test';
  });

  test('defaults to info level outside development', () => {
    process.env.NODE_ENV = 'test';
    logger = loadLogger();
    expect(logger.logLevel).toBe('info');
  });

  test('defaults to debug level in development', () => {
    process.env.NODE_ENV = 'development';
    logger = loadLogger();
    expect(logger.logLevel).toBe('debug');
  });

  test('respects LOG_LEVEL over environment default', () => {
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'error';
    logger = loadLogger();
    expect(logger.logLevel).toBe('error');
  });

  test('error always logs regardless of level', () => {
    process.env.LOG_LEVEL = 'error';
    logger = loadLogger();
    logger.error('boom');
    expect(console.error).toHaveBeenCalledTimes(1);
    const out = console.error.mock.calls[0][0];
    expect(out).toContain('[ERROR]');
    expect(out).toContain('boom');
  });

  test('info is suppressed at warn level', () => {
    process.env.LOG_LEVEL = 'warn';
    logger = loadLogger();
    logger.info('hello');
    expect(console.log).not.toHaveBeenCalled();
  });

  test('info logs at info level', () => {
    process.env.LOG_LEVEL = 'info';
    logger = loadLogger();
    logger.info('hello');
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log.mock.calls[0][0]).toContain('[INFO]');
  });

  test('debug is suppressed at info level (production default)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_LEVEL;
    logger = loadLogger();
    logger.debug('trace');
    expect(console.log).not.toHaveBeenCalled();
  });

  test('debug logs at debug level', () => {
    process.env.LOG_LEVEL = 'debug';
    logger = loadLogger();
    logger.debug('trace');
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log.mock.calls[0][0]).toContain('[DEBUG]');
  });

  test('warn logs at warn level and above', () => {
    process.env.LOG_LEVEL = 'warn';
    logger = loadLogger();
    logger.warn('careful');
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn.mock.calls[0][0]).toContain('[WARN]');
  });

  test('cv logs only in development', () => {
    process.env.NODE_ENV = 'test';
    logger = loadLogger();
    logger.cv('parsing');
    expect(console.log).not.toHaveBeenCalled();

    process.env.NODE_ENV = 'development';
    logger = loadLogger();
    logger.cv('parsing');
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log.mock.calls[0][0]).toContain('[CV]');
  });

  test('auth logs only in development', () => {
    process.env.NODE_ENV = 'production';
    logger = loadLogger();
    logger.auth('login attempt');
    expect(console.log).not.toHaveBeenCalled();
  });

  test('formatMessage includes timestamp, level and data', () => {
    process.env.LOG_LEVEL = 'error';
    logger = loadLogger();
    const formatted = logger.formatMessage('error', 'failed', { code: 500 });
    expect(formatted).toMatch(/\[\d{4}-\d{2}-\d{2}T[\d:.]+Z\] \[ERROR\] failed {"code":500}/);
  });

  test('formatMessage omits data when not provided', () => {
    logger = loadLogger();
    const formatted = logger.formatMessage('info', 'plain');
    expect(formatted).toMatch(/\[INFO\] plain$/);
    expect(formatted).not.toContain('null');
  });

  test('production always logs even at restrictive levels', () => {
    process.env.LOG_LEVEL = 'error';
    logger = loadLogger();
    logger.production('always visible');
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log.mock.calls[0][0]).toContain('always visible');
  });
});
