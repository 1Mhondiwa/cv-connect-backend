process.env.CLIENT_URL = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-secret';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(false),
  query: jest.fn()
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../app');
const db = require('../config/database');

const tokenFor = (userId, _userType) =>
  jwt.sign({ userId }, process.env.JWT_SECRET);

const adminRow = (id = 1) => ({
  user_id: id,
  email: 'admin@example.com',
  user_type: 'admin',
  is_active: true,
  is_verified: true
});

const freelancerRow = (id = 5) => ({
  user_id: id,
  email: 'freelancer@example.com',
  user_type: 'freelancer',
  is_active: true,
  is_verified: true
});

describe('associate request authorization', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.pool.query.mockReset();
  });

  describe('GET /api/associate-request/requests', () => {
    it('rejects unauthenticated access - the list contains applicant PII', async () => {
      const res = await request(app).get('/api/associate-request/requests');
      expect(res.status).toBe(401);
      expect(db.pool.query).not.toHaveBeenCalled();
    });

    it('allows admins to list requests', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [adminRow()] });
      db.pool.query.mockResolvedValueOnce({
        rowCount: 2,
        rows: [{ request_id: 1 }, { request_id: 2 }]
      });

      const res = await request(app)
        .get('/api/associate-request/requests')
        .set('Authorization', `Bearer ${tokenFor(1, 'admin')}`);

      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(2);
    });
  });

  describe('PUT /api/associate-request/requests/:requestId/review', () => {
    it('rejects unauthenticated review attempts', async () => {
      const res = await request(app)
        .put('/api/associate-request/requests/10/review')
        .send({ status: 'approved' });

      expect(res.status).toBe(401);
      expect(db.pool.query).not.toHaveBeenCalled();
    });

    it('rejects non-admin roles even with a valid token', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });

      const res = await request(app)
        .put('/api/associate-request/requests/10/review')
        .set('Authorization', `Bearer ${tokenFor(5, 'freelancer')}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(403);
      // Only the auth middleware's user lookup ran - nothing else
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.pool.query).not.toHaveBeenCalled();
    });

    it('rejects invalid statuses before writing anything', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [adminRow()] });

      const res = await request(app)
        .put('/api/associate-request/requests/10/review')
        .set('Authorization', `Bearer ${tokenFor(1, 'admin')}`)
        .send({ status: 'sure-whatever' });

      expect(res.status).toBe(400);
      // Auth lookup happened, but no write was attempted
      expect(db.query).toHaveBeenCalledTimes(1);
      expect(db.pool.query).not.toHaveBeenCalled();
    });

    it('records which admin reviewed and returns the updated row', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [adminRow(9)] });
      db.pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ request_id: 10, status: 'approved', reviewed_by: 9 }]
      });

      const res = await request(app)
        .put('/api/associate-request/requests/10/review')
        .set('Authorization', `Bearer ${tokenFor(9, 'admin')}`)
        .send({ status: 'approved', reviewer_comments: 'Looks legit' });

      expect(res.status).toBe(200);
      expect(res.body.data.reviewed_by).toBe(9);

      const updateCall = db.pool.query.mock.calls[0];
      expect(updateCall[0]).toMatch(/UPDATE "Associate_Request"/i);
      expect(updateCall[1]).toEqual(['approved', 9, 'Looks legit', '10']);
    });
  });

  describe('POST /api/associate-request/submit', () => {
    it('remains publicly accessible for companies applying through the site', async () => {
      db.pool.query.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ request_id: 77, email: 'corp@example.com', company_name: 'Corp Inc' }]
      });

      const res = await request(app)
        .post('/api/associate-request/submit')
        .send({
          email: 'corp@example.com',
          company_name: 'Corp Inc',
          industry: 'Tech',
          contact_person: 'Jane Doe',
          phone: '+1234567890'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.request_id).toBe(77);
    });

    it('validates required fields', async () => {
      const res = await request(app)
        .post('/api/associate-request/submit')
        .send({ email: 'corp@example.com' });

      expect(res.status).toBe(400);
      expect(db.pool.query).not.toHaveBeenCalled();
    });
  });
});
