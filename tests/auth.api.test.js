process.env.CLIENT_URL = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn(), end: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(false),
  query: jest.fn()
}));

const request = require('supertest');
const { app } = require('../app');
const db = require('../config/database');

describe('GET /api/health', () => {
  it('returns 200 with service status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.service).toBe('CV-Connect Backend');
    expect(res.body.environment).toBeDefined();
  });
});

describe('POST /api/auth/login validation', () => {
  it('rejects requests missing email and password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects malformed emails', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'whatever1!' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/request-reset', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it('responds generically and leaks nothing for unknown emails', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const res = await request(app)
      .post('/api/auth/request-reset')
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.debug).toBeUndefined();

    // No token update may be issued for unknown users
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('does not expose the reset token when NODE_ENV is production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 42 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const res = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: 'known@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.debug).toBeUndefined();
    } finally {
      if (originalEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalEnv;
      }
    }
  });

  it('exposes the reset token only outside production (dev convenience)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 42 }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const res = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: 'known@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.debug).toBeDefined();
      expect(typeof res.body.debug.reset_token).toBe('string');
      expect(res.body.debug.reset_token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      // Token must be persisted with an expiry
      const updateCall = db.query.mock.calls[1];
      expect(updateCall[0]).toMatch(/UPDATE "User"/i);
      expect(updateCall[1]).toContain(res.body.debug.reset_token);
    } finally {
      if (originalEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalEnv;
      }
    }
  });
});
