process.env.CLIENT_URL = 'http://localhost:3000';
process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';

jest.mock('../config/database', () => ({
  pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(false),
  query: jest.fn()
}));

jest.mock('../utils/activityLogger', () => ({
  logActivity: jest.fn().mockResolvedValue(true)
}));

jest.mock('../services/notificationService', () => ({
  createInterviewScheduledNotification: jest.fn().mockResolvedValue({}),
  sendNotification: jest.fn().mockResolvedValue(true),
  createInterviewReminders: jest.fn().mockResolvedValue({}),
  getUserNotifications: jest.fn().mockResolvedValue([]),
  markAsRead: jest.fn().mockResolvedValue(true)
}));

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../app');
const db = require('../config/database');
const NotificationService = require('../services/notificationService');

const tokenFor = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET);

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
  last_name: 'Doe'
});

const futureDate = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe('Interview API', () => {
  let mockClient;

  beforeEach(() => {
    db.query.mockReset();
    db.pool.query.mockReset();
    db.pool.connect.mockReset();
    jest.clearAllMocks();

    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    db.pool.connect.mockResolvedValue(mockClient);
  });

  describe('POST /api/interview/schedule', () => {
    it('rejects unauthenticated', async () => {
      const res = await request(app).post('/api/interview/schedule').send({ request_id: 1, freelancer_id: 1, scheduled_date: futureDate() });
      expect(res.status).toBe(401);
    });

    it('rejects non-associate roles', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });

      const res = await request(app)
        .post('/api/interview/schedule')
        .set('Authorization', `Bearer ${tokenFor(4)}`)
        .send({ request_id: 1, freelancer_id: 1, scheduled_date: futureDate() });

      expect(res.status).toBe(403);
    });

    it('validates required fields', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });

      const res = await request(app)
        .post('/api/interview/schedule')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ request_id: 1, freelancer_id: 1 });

      expect(res.status).toBe(400);
    });

    it('rejects invalid interview type', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });

      const res = await request(app)
        .post('/api/interview/schedule')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ request_id: 1, freelancer_id: 1, scheduled_date: futureDate(), interview_type: 'smoke_signal' });

      expect(res.status).toBe(400);
    });

    it('rejects past scheduled date', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });

      const res = await request(app)
        .post('/api/interview/schedule')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ request_id: 1, freelancer_id: 1, scheduled_date: new Date(Date.now() - 1000).toISOString() });

      expect(res.status).toBe(400);
    });

    it('rejects when request is not found', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // request lookup
        .mockResolvedValueOnce({});

      const res = await request(app)
        .post('/api/interview/schedule')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ request_id: 999, freelancer_id: 1, scheduled_date: futureDate() });

      expect(res.status).toBe(404);
    });

    it('rejects when request does not belong to associate', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ associate_user_id: 99 }] }) // request lookup
        .mockResolvedValueOnce({});                     // ROLLBACK

      const res = await request(app)
        .post('/api/interview/schedule')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ request_id: 1, freelancer_id: 1, scheduled_date: futureDate() });

      expect(res.status).toBe(403);
    });

    it('rejects when freelancer is not recommended', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ associate_user_id: 3 }] }) // request lookup
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // recommendation lookup
        .mockResolvedValueOnce({});                     // ROLLBACK

      const res = await request(app)
        .post('/api/interview/schedule')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ request_id: 1, freelancer_id: 1, scheduled_date: futureDate() });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/not recommended/i);
    });

    it('rejects when interview already scheduled', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ associate_user_id: 3 }] }) // request lookup
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ interview_id: 1 }] }) // recommendation
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ interview_id: 1 }] }) // existing interview
        .mockResolvedValueOnce({});                     // ROLLBACK

      const res = await request(app)
        .post('/api/interview/schedule')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ request_id: 1, freelancer_id: 1, scheduled_date: futureDate() });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already a scheduled interview/i);
    });

    it('successfully schedules a video interview', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 4 }] });

      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ associate_user_id: 3 }] }) // request lookup
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ interview_id: 1 }] }) // recommendation
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // existing interview
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ interview_id: 1 }] }) // INSERT
        .mockResolvedValueOnce({});                     // COMMIT

      const res = await request(app)
        .post('/api/interview/schedule')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({
          request_id: 1,
          freelancer_id: 1,
          scheduled_date: futureDate(),
          interview_type: 'video'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.interview_id).toBe(1);
      expect(res.body.data.meeting_link).toBeTruthy();
    });
  });

  describe('GET /api/interview', () => {
    it('returns interviews for associate', async () => {
      const interview = { interview_id: 1, scheduled_date: futureDate(), freelancer_first_name: 'John' };
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [interview] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const res = await request(app)
        .get('/api/interview')
        .set('Authorization', `Bearer ${tokenFor(3)}`);

      expect(res.status).toBe(200);
      expect(res.body.interviews).toHaveLength(1);
      expect(res.body.interviews[0].interview_id).toBe(1);
    });

    it('returns interviews with status filter', async () => {
      db.query
        .mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] })
        .mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const res = await request(app)
        .get('/api/interview?status=scheduled')
        .set('Authorization', `Bearer ${tokenFor(3)}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects unauthorized roles', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ user_id: 1, user_type: 'admin', is_active: true }] });

      const res = await request(app)
        .get('/api/interview')
        .set('Authorization', `Bearer ${tokenFor(1)}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/interview/respond', () => {
    it('rejects unauthenticated', async () => {
      const res = await request(app).post('/api/interview/respond').send({ interview_id: 1, response: 'accepted' });
      expect(res.status).toBe(401);
    });

    it('invalid response', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });

      const res = await request(app)
        .post('/api/interview/respond')
        .set('Authorization', `Bearer ${tokenFor(4)}`)
        .send({ interview_id: 1, response: 'maybe' });

      expect(res.status).toBe(400);
    });

    it('interview not found for freelancer', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // interview lookup
        .mockResolvedValueOnce({});                     // ROLLBACK

      const res = await request(app)
        .post('/api/interview/respond')
        .set('Authorization', `Bearer ${tokenFor(4)}`)
        .send({ interview_id: 999, response: 'accepted' });

      expect(res.status).toBe(404);
    });

    it('rejects when interview is not scheduled', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'completed' }] }) // interview lookup
        .mockResolvedValueOnce({});                     // ROLLBACK

      const res = await request(app)
        .post('/api/interview/respond')
        .set('Authorization', `Bearer ${tokenFor(4)}`)
        .send({ interview_id: 1, response: 'accepted' });

      expect(res.status).toBe(400);
    });

    it('accepts interview invitation', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'scheduled' }] }) // interview lookup
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // UPDATE
        .mockResolvedValueOnce({});                     // COMMIT

      const res = await request(app)
        .post('/api/interview/respond')
        .set('Authorization', `Bearer ${tokenFor(4)}`)
        .send({ interview_id: 1, response: 'accepted', response_notes: 'Looking forward' });

      expect(res.status).toBe(200);
      expect(res.body.data.response).toBe('accepted');
    });

    it('declines interview invitation', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'scheduled' }] }) // interview lookup
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // UPDATE
        .mockResolvedValueOnce({});                     // COMMIT

      const res = await request(app)
        .post('/api/interview/respond')
        .set('Authorization', `Bearer ${tokenFor(4)}`)
        .send({ interview_id: 1, response: 'declined' });

      expect(res.status).toBe(200);
      expect(res.body.data.response).toBe('declined');
    });
  });

  describe('POST /api/interview/feedback', () => {
    it('rejects unauthenticated', async () => {
      const res = await request(app).post('/api/interview/feedback').send({ interview_id: 1, feedback: 'Good', recommendation: 'hire' });
      expect(res.status).toBe(401);
    });

    it('validates required fields', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });

      const res = await request(app)
        .post('/api/interview/feedback')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ interview_id: 1 });

      expect(res.status).toBe(400);
    });

    it('rejects invalid recommendation', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });

      const res = await request(app)
        .post('/api/interview/feedback')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ interview_id: 1, feedback: 'Good', recommendation: 'definitely' });

      expect(res.status).toBe(400);
    });

    it('rejects out-of-range rating', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });

      const res = await request(app)
        .post('/api/interview/feedback')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ interview_id: 1, feedback: 'Good', recommendation: 'hire', rating: 9 });

      expect(res.status).toBe(400);
    });

    it('rejects when interview not completed', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'scheduled' }] }) // interview lookup
        .mockResolvedValueOnce({});                     // ROLLBACK

      const res = await request(app)
        .post('/api/interview/feedback')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ interview_id: 1, feedback: 'Good', recommendation: 'hire' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/completed/i);
    });

    it('rejects duplicate feedback', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'completed' }] }) // interview lookup
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ feedback_id: 1 }] }) // existing feedback
        .mockResolvedValueOnce({});                     // ROLLBACK

      const res = await request(app)
        .post('/api/interview/feedback')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ interview_id: 1, feedback: 'Good', recommendation: 'hire' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already been submitted/i);
    });

    it('successfully submits feedback', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'completed' }] }) // interview lookup
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // no existing feedback
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ feedback_id: 42 }] }) // INSERT
        .mockResolvedValueOnce({});                     // COMMIT

      const res = await request(app)
        .post('/api/interview/feedback')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ interview_id: 1, feedback: 'Great candidate', recommendation: 'hire', rating: 5 });

      expect(res.status).toBe(201);
      expect(res.body.data.feedback_id).toBe(42);
      expect(res.body.data.recommendation).toBe('hire');
    });
  });

  describe('PUT /api/interview/status', () => {
    it('rejects unauthenticated', async () => {
      const res = await request(app).put('/api/interview/status').send({ interview_id: 1, status: 'completed' });
      expect(res.status).toBe(401);
    });

    it('rejects invalid status', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });

      const res = await request(app)
        .put('/api/interview/status')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ interview_id: 1, status: 'bogus' });

      expect(res.status).toBe(400);
    });

    it('rejects interview not found', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // interview lookup
        .mockResolvedValueOnce({});                     // ROLLBACK

      const res = await request(app)
        .put('/api/interview/status')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ interview_id: 999, status: 'completed' });

      expect(res.status).toBe(404);
    });

    it('updates interview status', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });
      mockClient.query
        .mockResolvedValueOnce({})                     // BEGIN
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ status: 'in_progress' }] }) // interview lookup
        .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // UPDATE
        .mockResolvedValueOnce({});                     // COMMIT

      const res = await request(app)
        .put('/api/interview/status')
        .set('Authorization', `Bearer ${tokenFor(3)}`)
        .send({ interview_id: 1, status: 'completed', notes: 'Went well' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
    });
  });

  describe('GET /api/interview/my-feedback', () => {
    it('rejects non-freelancer', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [associateRow()] });

      const res = await request(app)
        .get('/api/interview/my-feedback')
        .set('Authorization', `Bearer ${tokenFor(3)}`);

      expect(res.status).toBe(403);
    });

    it('returns feedback summary for freelancer', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });

      const res = await request(app)
        .get('/api/interview/my-feedback')
        .set('Authorization', `Bearer ${tokenFor(4)}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalInterviews).toBe(0);
    });
  });

  describe('GET /api/interview/notifications', () => {
    it('returns notifications for user', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });
      NotificationService.getUserNotifications.mockResolvedValue([{ id: 1, title: 'Test' }]);

      const res = await request(app)
        .get('/api/interview/notifications')
        .set('Authorization', `Bearer ${tokenFor(4)}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('PUT /api/interview/notifications/:id/read', () => {
    it('marks notification as read', async () => {
      db.query.mockResolvedValueOnce({ rowCount: 1, rows: [freelancerRow()] });
      NotificationService.markAsRead.mockResolvedValue(true);

      const res = await request(app)
        .put('/api/interview/notifications/1/read')
        .set('Authorization', `Bearer ${tokenFor(4)}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
