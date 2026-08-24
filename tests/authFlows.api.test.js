process.env.CLIENT_URL = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

jest.mock('../config/database', () => {
  const clientQuery = jest.fn();
  const client = {
    query: clientQuery,
    release: jest.fn()
  };
  return {
    pool: {
      connect: jest.fn().mockResolvedValue(client),
      end: jest.fn()
    },
    testConnection: jest.fn().mockResolvedValue(false),
    query: jest.fn()
  };
});

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { app } = require('../app');
const db = require('../config/database');

const strongPassword = 'Str0ng!Passw0rd';

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  it('returns identical errors for unknown emails and wrong passwords', async () => {
    db.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'whatever1!' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.message).toBe('Invalid email or password');

    const hashed = bcrypt.hashSync(strongPassword, 10);
    db.query.mockReset();
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 1, email: 'known@example.com', user_type: 'freelancer', is_active: true, is_verified: true, has_changed_temp_password: true, hashed_password: hashed }]
    });

    const wrongPw = await request(app)
      .post('/api/auth/login')
      .send({ email: 'known@example.com', password: 'WrongPass1!' });
    expect(wrongPw.status).toBe(401);
    // No user enumeration: same message and status as unknown email
    expect(wrongPw.body.message).toBe(unknown.body.message);
    expect(wrongPw.body.success).toBe(false);
  });

  it('rejects inactive accounts even with correct credentials', async () => {
    const hashed = bcrypt.hashSync(strongPassword, 10);
    db.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ user_id: 2, email: 'inactive@example.com', user_type: 'freelancer', is_active: false, is_verified: true, has_changed_temp_password: true, hashed_password: hashed }]
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'inactive@example.com', password: strongPassword });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/inactive/i);
    // Must not have reached token generation / last_login update
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('logs a freelancer in: issues a JWT, updates last_login, merges profile data', async () => {
    const hashed = bcrypt.hashSync(strongPassword, 10);
    db.query
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ user_id: 7, email: 'freelancer@example.com', user_type: 'freelancer', is_active: true, is_verified: true, has_changed_temp_password: false, hashed_password: hashed }]
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ freelancer_id: 11, first_name: 'Ada', last_name: 'Byron', phone: '+1234567890', profile_picture_url: null }]
      });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'freelancer@example.com', password: strongPassword });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Token must verify against the server secret and carry the user id
    const payload = jwt.verify(res.body.token, process.env.JWT_SECRET);
    expect(payload.userId).toBe(7);

    // Profile fields from the second table are merged into the response
    expect(res.body.user.user_id).toBe(7);
    expect(res.body.user.freelancer_id).toBe(11);
    expect(res.body.user.first_name).toBe('Ada');

    // The response must never echo the password hash back
    expect(JSON.stringify(res.body)).not.toContain(hashed);

    const updateCall = db.query.mock.calls[1];
    expect(updateCall[0]).toMatch(/last_login = NOW\(\)/i);
    expect(updateCall[1]).toContain(7);
  });
});

describe('POST /api/auth/register', () => {
  let client;

  beforeEach(async () => {
    db.query.mockReset();
    db.pool.connect.mockClear();
    // The factory binds one shared client; fetch it without relying on call history
    client = await db.pool.connect();
    client.query.mockReset();
    client.release.mockReset();
  });

  it('rejects weak passwords with actionable messages before touching the database', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@example.com', password: 'weakpass' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    // Validation fails before any SQL runs
    expect(client.query).not.toHaveBeenCalled();
  });

  it('rejects duplicate emails with 409 without creating anything', async () => {
    client.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 3 }] });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'taken@example.com', password: strongPassword, first_name: 'A', last_name: 'B', phone: '+123' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Email already exists');
    // No transaction was opened
    const sqlCalls = client.query.mock.calls.map(c => c[0]);
    expect(sqlCalls).not.toContain('BEGIN');
  });

  it('registers a freelancer inside a committed transaction and returns a verifiable token', async () => {
    client.query.mockImplementation(async (sql) => {
      if (/SELECT \* FROM "User"/.test(sql)) return { rowCount: 0, rows: [] };
      if (/INSERT INTO "User"/.test(sql)) return { rowCount: 1, rows: [{ user_id: 21 }] };
      if (/INSERT INTO "Freelancer"/.test(sql)) return { rowCount: 1, rows: [{ freelancer_id: 33 }] };
      return { rowCount: 0, rows: [] }; // BEGIN / COMMIT
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'fresh@example.com', password: strongPassword, first_name: 'Grace', last_name: 'Hopper', phone: '+19998887777' });

    expect(res.status).toBe(201);
    expect(res.body.data.user_id).toBe(21);
    expect(res.body.data.freelancer_id).toBe(33);

    // Token verifies against the shared secret
    const payload = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
    expect(payload.userId).toBe(21);

    // Stored password must be a bcrypt hash, never plaintext
    const sqlCalls = client.query.mock.calls.map(c => c[0]);
    expect(sqlCalls[0]).toMatch(/SELECT \* FROM "User"/);
    expect(sqlCalls).toContain('BEGIN');
    expect(sqlCalls).toContain('COMMIT');
    const insertUserCall = client.query.mock.calls.find(c => /INSERT INTO "User"/.test(c[0]));
    expect(insertUserCall[1][0]).toBe('fresh@example.com');
    expect(insertUserCall[1][1]).not.toBe(strongPassword);
    expect(insertUserCall[1][1]).toMatch(/^\$2[aby]\$/);

    // Client released back to the pool exactly once
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
