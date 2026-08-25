process.env.CLIENT_URL = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-secret';

// Create mock client once
const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

jest.mock('../config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn(),
  },
  testConnection: jest.fn().mockResolvedValue(false),
  query: jest.fn(),
}));

jest.mock('../utils/contractManager', () => ({
  updateExpiredContracts: jest.fn().mockResolvedValue({
    success: true,
    message: 'Expired contracts updated',
    updated_count: 3
  })
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../app');
const db = require('../config/database');
const dbPool = db.pool;

// Helper to generate tokens
const tokenFor = (userId, userType = 'admin') =>
  jwt.sign({ userId }, process.env.JWT_SECRET);

// Mock user rows for authentication
const adminRow = (id = 1) => ({
  user_id: id,
  email: `admin${id}@example.com`,
  user_type: 'admin',
  is_active: true,
  is_verified: true,
});

const ecsEmployeeRow = (id = 2) => ({
  user_id: id,
  email: `ecs${id}@example.com`,
  user_type: 'ecs_employee',
  is_active: true,
  is_verified: true,
});

const associateRow = (id = 3) => ({
  user_id: id,
  email: `associate${id}@example.com`,
  user_type: 'associate',
  is_active: true,
  is_verified: true,
  associate_id: 10,
  user_id: id,
});

const freelancerRow = (id = 4) => ({
  user_id: id,
  email: `freelancer${id}@example.com`,
  user_type: 'freelancer',
  is_active: true,
  is_verified: true,
  freelancer_id: 10,
  user_id: id,
});

// Mock database query helper
const mockDbQuery = (responses) => {
  let callIndex = 0;
  db.query.mockImplementation(async (...args) => {
    if (callIndex < responses.length) {
      const result = responses[callIndex++];
      if (result instanceof Error) throw result;
      return result;
    }
    return { rows: [], rowCount: 0 };
  });
};

const mockPoolQuery = (responses) => {
  let callIndex = 0;
  db.pool.query.mockImplementation(async (...args) => {
    if (callIndex < responses.length) {
      const result = responses[callIndex++];
      if (result instanceof Error) throw result;
      return result;
    }
    return { rows: [], rowCount: 0 };
  });
};

describe('Associate Request & Hiring API', () => {
  let client;

  beforeEach(async () => {
    db.query.mockReset();
    dbPool.query.mockReset();
    db.pool.query.mockReset();
    db.pool.connect.mockClear();
    dbPool.connect.mockClear();
    
    // The mock client is already created in the jest.mock factory
    client = {
      query: jest.fn(),
      release: jest.fn()
    };
    // Update the mock to return this client
    db.pool.connect.mockResolvedValue(client);
    client.query.mockReset();
    client.release.mockReset();
  });

  describe('Associate Request Review Flow', () => {
    describe('GET /api/associate-request/requests', () => {
      it('rejects unauthenticated access', async () => {
        const res = await request(app).get('/api/associate-request/requests');
        expect(res.status).toBe(401);
        expect(dbPool.query).not.toHaveBeenCalled();
      });

      it('rejects non-admin roles', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 5, user_type: 'freelancer', is_active: true, is_verified: true }] });
        
        const res = await request(app)
          .get('/api/associate-request/requests')
          .set('Authorization', `Bearer ${tokenFor(5, 'freelancer')}`);

        expect(res.status).toBe(403);
        expect(dbPool.query).not.toHaveBeenCalled();
      });

it('allows admin to list requests', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] });
      dbPool.query.mockResolvedValueOnce({
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

      it('rejects non-admin roles', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 5, user_type: 'freelancer', is_active: true, is_verified: true }] });

        const res = await request(app)
          .put('/api/associate-request/requests/10/review')
          .set('Authorization', `Bearer ${tokenFor(5, 'freelancer')}`)
          .send({ status: 'approved' });

        expect(res.status).toBe(403);
        // Only user lookup should have run
        expect(db.query).toHaveBeenCalledTimes(1);
        expect(dbPool.query).not.toHaveBeenCalled();
      });

      it('rejects invalid statuses before any write', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] });

        const res = await request(app)
          .put('/api/associate-request/requests/10/review')
          .set('Authorization', `Bearer ${tokenFor(1, 'admin')}`)
          .send({ status: 'invalid' });

        expect(res.status).toBe(400);
        expect(db.pool.query).not.toHaveBeenCalled();
      });

      it('records which admin reviewed and returns the updated row', async () => {
        db.query
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 9, user_type: 'admin', is_active: true, is_verified: true }] });
        dbPool.query.mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ request_id: 10, status: 'approved', reviewed_by: 9, reviewer_comments: 'Looks legit', reviewed_at: new Date().toISOString() }]
        });

        const res = await request(app)
          .put('/api/associate-request/requests/10/review')
          .set('Authorization', `Bearer ${tokenFor(9, 'admin')}`)
          .send({ status: 'approved', reviewer_comments: 'Looks legit' });

        expect(res.status).toBe(200);
        expect(res.body.data.reviewed_by).toBe(9);
        expect(res.body.data.status).toBe('approved');

        const updateCall = dbPool.query.mock.calls[0];
        expect(updateCall[0]).toMatch(/UPDATE "Associate_Request"/i);
        expect(updateCall[1]).toEqual(['approved', 9, 'Looks legit', '10']);
      });

      it('sets reviewed_by to null when reviewer_comments is omitted', async () => {
        db.query
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 9, user_type: 'admin', is_active: true, is_verified: true }] });
        dbPool.query.mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ request_id: 10, status: 'rejected', reviewed_by: 9, reviewer_comments: null }]
        });

        const res = await request(app)
          .put('/api/associate-request/requests/10/review')
          .set('Authorization', `Bearer ${tokenFor(9, 'admin')}`)
          .send({ status: 'rejected' });

        expect(res.status).toBe(200);
        expect(res.body.data.reviewed_by).toBe(9);
        expect(res.body.data.reviewer_comments).toBeNull();

        const updateCall = dbPool.query.mock.calls[0];
        expect(updateCall[1][2]).toBeNull(); // reviewer_comments is null
      });
    });
  });

  describe('Hiring API', () => {
    describe('POST /api/hiring/hire', () => {
      beforeEach(() => {
        // Mock multer file upload by attaching file to request
        // We'll use a mock that doesn't require actual file upload
      });

      it('rejects unauthenticated hire attempts', async () => {
        const res = await request(app)
          .post('/api/hiring/hire')
          .field('request_id', '1')
          .field('freelancer_id', '1')
          .field('project_title', 'Test Project');

        expect(res.status).toBe(401);
      });

      it('rejects non-associate roles', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 5, user_type: 'freelancer', is_active: true, is_verified: true }] });

        const res = await request(app)
          .post('/api/hiring/hire')
          .set('Authorization', `Bearer ${tokenFor(5, 'freelancer')}`)
          .field('request_id', '1')
          .field('freelancer_id', '1')
          .field('project_title', 'Test Project');

        expect(res.status).toBe(403);
      });

      it('rejects hire without contract PDF', async () => {
        db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'associate', is_active: true, is_verified: true, associate_id: 1 }] });

        const res = await request(app)
          .post('/api/hiring/hire')
          .set('Authorization', `Bearer ${tokenFor(1, 'associate')}`)
          .field('request_id', '1')
          .field('freelancer_id', '1')
          .field('project_title', 'Test Project');

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/contract.*pdf/i);
      });
    });

    describe('GET /api/hiring/recent-hires', () => {
      it('rejects unauthenticated access', async () => {
        const res = await request(app).get('/api/hiring/recent-hires');
        expect(res.status).toBe(401);
      });

      it('allows admin to fetch recent hires', async () => {
        db.query
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] })
          .mockResolvedValueOnce({
            rowCount: 2,
            rows: [
              { hire_id: 1, project_title: 'Project A', hire_date: new Date().toISOString(), associate_name: 'Assoc1', freelancer_first_name: 'John', freelancer_last_name: 'Doe', freelancer_role: 'Developer' },
              { hire_id: 2, project_title: 'Project B', hire_date: new Date().toISOString(), associate_name: 'Assoc2', freelancer_first_name: 'Jane', freelancer_last_name: 'Smith', freelancer_role: 'Designer' }
            ]
          });

        const res = await request(app)
          .get('/api/hiring/recent-hires')
          .set('Authorization', `Bearer ${tokenFor(1, 'admin')}`);

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
      it('returns hiring statistics for admin', async () => {
        db.query
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true, is_verified: true }] })
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ total_hires: '50' }] })
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ recent_hires: '5' }] })
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ active_projects: '12' }] });

        const res = await request(app)
          .get('/api/hiring/stats')
          .set('Authorization', `Bearer ${tokenFor(1, 'admin')}`);

        expect(res.status).toBe(200);
        expect(res.body.stats).toEqual({
          total_hires: 50,
          recent_hires: 5,
          active_projects: 12
        });
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
        db.query.mockResolvedValueOnce({ rowCount: 1, rows: [adminRow(1)] });
        
        const res = await request(app)
          .post('/api/hiring/check-expired-contracts')
          .set('Authorization', `Bearer ${tokenFor(1, 'admin')}`);

        expect(res.status).toBe(200);
        expect(res.body.updated_count).toBe(3);
      });
    });
  });
});