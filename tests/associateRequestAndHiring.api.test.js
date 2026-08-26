process.env.CLIENT_URL = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

jest.mock('../config/database', () => {
  const mockQuery = jest.fn();
  const mockConnect = jest.fn().mockResolvedValue({
    query: jest.fn(),
    release: jest.fn()
  });

  return {
    pool: {
      connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn()
      }),
      query: jest.fn(),
      end: jest.fn()
    },
    testConnection: jest.fn().mockResolvedValue(false),
    query: jest.fn()
  };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../app');
const db = require('../config/database');

const tokenFor = (userId, userType) =>
  jwt.sign({ userId }, process.env.JWT_SECRET);

const adminRow = (id = 1) => ({
  user_id: id,
  email: `admin${id}@example.com`,
  user_type: 'admin',
  is_active: true,
  is_verified: true
});

const ecsRow = (id = 2) => ({
  user_id: id,
  email: `ecs${id}@example.com`,
  user_type: 'ecs_employee',
  is_active: true,
  is_verified: true
});

const associateRow = (id = 3) => ({
  user_id: id,
  email: `associate${id}@example.com`,
  user_type: 'associate',
  is_active: true,
  is_verified: true,
  associate_id: 10
});

const freelancerRow = (id = 4) => ({
  user_id: id,
  email: `freelancer${id}@example.com`,
  user_type: 'freelancer',
  is_active: true,
  is_verified: true,
  freelancer_id: 10,
  first_name: 'John',
  last_name: 'Doe',
  headline: 'Developer'
});

describe('Associate Request & Hiring API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const adminToken = (id = 1) => tokenFor(id, 'admin');
  const ecsToken = () => tokenFor(2, 'ecs_employee');
  const associateToken = (id = 3) => tokenFor(3, 'associate');
  const freelancerToken = (id = 4) => tokenFor(4, 'freelancer');

  describe('POST /api/associate-request/submit', () => {
    it('rejects unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/associate-request/submit')
        .send({ email: 'corp@example.com', company_name: 'Test Corp', industry: 'Tech', contact_person: 'Jane Doe', phone: '+1234567890', request_reason: 'Need developers' });
      expect(res.status).toBe(401);
    });

    it('allows associate to submit request', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_id: 42 }] });

      const res = await request(app)
        .post('/api/associate-request/submit')
        .set('Authorization', `Bearer ${associateToken()}`)
        .send({ email: 'corp@example.com', company_name: 'Test Corp', industry: 'Tech', contact_person: 'Jane Doe', phone: '+1234567890', request_reason: 'Need developers' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.request_id).toBe(42);
    });

    it('validates required fields', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });

      const res = await request(app)
        .post('/api/associate-request/submit')
        .set('Authorization', `Bearer ${associateToken()}`)
        .send({ email: 'corp@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/associate-request/requests', () => {
    it('rejects unauthenticated', async () => {
      const res = await request(app).get('/api/associate-request/requests');
      expect(res.status).toBe(401);
    });

    it('allows admin to list requests', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] })
        .mockResolvedValueOnce({ rowCount: 2, rows: [{ request_id: 1, email: 'a@b.com', status: 'pending' }, { request_id: 2, email: 'c@d.com', status: 'approved' }] });

      const res = await request(app)
        .get('/api/associate-request/requests')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.requests).toHaveLength(2);
    });

    it('rejects non-admin', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 4, user_type: 'freelancer', is_active: true, is_verified: true }] });

      const res = await request(app)
        .get('/api/associate-request/requests')
        .set('Authorization', `Bearer ${freelancerToken()}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/associate-request/requests/:requestId/review', () => {
    it('rejects unauthenticated', async () => {
      const res = await request(app).put('/api/associate-request/requests/1/review').send({ status: 'approved' });
      expect(res.status).toBe(401);
    });

    it('rejects non-admin', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 4, user_type: 'freelancer', is_active: true, is_verified: true }] });

      const res = await request(app)
        .put('/api/associate-request/requests/1/review')
        .set('Authorization', `Bearer ${freelancerToken()}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(403);
    });

    it('rejects invalid status', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] });

      const res = await request(app)
        .put('/api/associate-request/requests/10/review')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('approves request and records reviewer', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_id: 5, status: 'approved', reviewed_by: 1 }] });

      const res = await request(app)
        .put('/api/associate-request/requests/5/review')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'approved', reviewer_comments: 'Approved' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
      expect(res.body.data.reviewed_by).toBe(1);
    });

    it('rejects request with comments', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ request_id: 2, status: 'rejected', reviewed_by: 1 }] });

      const res = await request(app)
        .put('/api/associate-request/requests/2/review')
        .set('Authorization', `Bearer ${adminToken()}`)
        .send({ status: 'rejected', reviewer_comments: 'Does not meet requirements' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('rejected');
      expect(res.body.data.reviewed_by).toBe(1);
    });
  });
});

describe('Hiring API', () => {
  beforeEach(() => {
    db.query.mockReset();
    db.pool.query.mockReset();
    db.pool.connect.mockClear();
  });

  const associateToken = (id = 3) => tokenFor(id, 'associate');
  const freelancerToken = (id = 4) => tokenFor(id, 'freelancer');

  describe('POST /api/hiring/hire', () => {
    it('rejects unauthenticated', async () => {
      const res = await request(app).post('/api/hiring/hire').send({ request_id: 1, freelancer_id: 1, project_title: 'Test' });
      expect(res.status).toBe(401);
    });

    it('rejects non-associate roles', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 4, user_type: 'freelancer', is_active: true }] });

      const res = await request(app)
        .post('/api/hiring/hire')
        .set('Authorization', `Bearer ${tokenFor(4, 'freelancer')}`)
        .send({ request_id: 1, freelancer_id: 1, project_title: 'Test' });

      expect(res.status).toBe(403);
    });

    it('requires contract PDF upload', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 3, user_type: 'associate', is_active: true }] });

      const res = await request(app)
        .post('/api/hiring/hire')
        .set('Authorization', `Bearer ${associateToken()}`)
        .send({ request_id: 1, freelancer_id: 1, project_title: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/contract.*pdf/i);
    });
  });

  describe('GET /api/hiring/recent-hires', () => {
    it('rejects unauthenticated', async () => {
      const res = await request(app).get('/api/hiring/recent-hires');
      expect(res.status).toBe(401);
    });

    it('allows admin to fetch recent hires', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] })
        .mockResolvedValueOnce({ rowCount: 2, rows: [{ hire_id: 1, project_title: 'Project A' }, { hire_id: 2, project_title: 'Project B' }] });

      const res = await request(app)
        .get('/api/hiring/recent-hires')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.hires).toHaveLength(2);
    });

    it('allows ecs_employee to list recent hires', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 2, user_type: 'ecs_employee', is_active: true, is_verified: true }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ hire_id: 1, project_title: 'Project A', hire_date: new Date().toISOString() }] });

      const res = await request(app)
        .get('/api/hiring/recent-hires')
        .set('Authorization', `Bearer ${tokenFor(2, 'ecs_employee')}`);

      expect(res.status).toBe(200);
      expect(res.body.hires).toHaveLength(1);
    });
  });

  describe('GET /api/hiring/stats', () => {
    it('returns stats for admin', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ total_hires: '50' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ recent_hires: '5' }] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ active_projects: '12' }] });

      const res = await request(app)
        .get('/api/hiring/stats')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.stats.total_hires).toBe(50);
      expect(res.body.stats.recent_hires).toBe(5);
      expect(res.body.stats.active_projects).toBe(12);
    });
  });

  describe('POST /api/hiring/check-expired-contracts', () => {
    it('rejects non-admin', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 5, user_type: 'freelancer', is_active: true, is_verified: true }] });

      const res = await request(app)
        .post('/api/hiring/check-expired-contracts')
        .set('Authorization', `Bearer ${tokenFor(5, 'freelancer')}`);

      expect(res.status).toBe(403);
    });

    it('allows admin to trigger contract expiration check', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] });

      const res = await request(app)
        .post('/api/hiring/check-expired-contracts')
        .set('Authorization', `Bearer ${adminToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.updated_count).toBe(3);
    });
  });
});