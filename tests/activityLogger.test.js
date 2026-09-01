// tests/activityLogger.test.js — unit tests for the activity logging utility
jest.mock('../config/database', () => ({
  pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(false),
  query: jest.fn()
}));

const db = require('../config/database');
const { logActivity } = require('../utils/activityLogger');

const baseActivity = {
  user_id: 7,
  role: 'associate',
  activity_type: 'freelancer_hired',
  status: 'Completed',
  details: 'Hired freelancer 3 for Build Website',
};

const insertResult = (overrides = {}) => ({
  rows: [
    {
      activity_id: 101,
      activity_date: '2026-09-01T10:00:00Z',
      ...overrides,
    },
  ],
});

describe('logActivity', () => {
  beforeEach(() => {
    db.query.mockReset();
    delete global.app;
  });

  test('inserts the activity and returns the inserted row', async () => {
    db.query.mockResolvedValueOnce(insertResult());

    const result = await logActivity(baseActivity);

    expect(db.query).toHaveBeenCalledTimes(1);
    const [query, params] = db.query.mock.calls[0];
    expect(query).toContain('INSERT INTO "Activity"');
    expect(query).toContain('RETURNING activity_id, activity_date');
    expect(params).toEqual([7, 'associate', 'freelancer_hired', 'Completed', 'Hired freelancer 3 for Build Website']);
    expect(result).toEqual({
      activity_id: 101,
      activity_date: '2026-09-01T10:00:00Z',
    });
  });

  test('applies the Completed status default', async () => {
    db.query.mockResolvedValueOnce(insertResult());

    await logActivity({
      user_id: 7,
      role: 'freelancer',
      activity_type: 'cv_uploaded',
    });

    expect(db.query.mock.calls[0][1][3]).toBe('Completed');
  });

  test('applies the null details default', async () => {
    db.query.mockResolvedValueOnce(insertResult());

    await logActivity({
      user_id: 7,
      role: 'freelancer',
      activity_type: 'cv_uploaded',
      status: 'Pending',
    });

    expect(db.query.mock.calls[0][1][4]).toBeNull();
  });

  test('broadcasts to the user SSE connection when available', async () => {
    db.query.mockResolvedValueOnce(insertResult());

    const write = jest.fn();
    global.app = {
      locals: {
        activityConnections: new Map([[7, { write }]]),
      },
    };

    await logActivity(baseActivity);

    expect(write).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(write.mock.calls[0][0].replace('data: ', '').trim());
    expect(payload.type).toBe('new_activity');
    expect(payload.activity).toEqual({
      activity_id: 101,
      activity_date: '2026-09-01T10:00:00Z',
      activity_type: 'freelancer_hired',
      status: 'Completed',
      details: 'Hired freelancer 3 for Build Website',
    });
  });

  test('formats the SSE message as a data event', async () => {
    db.query.mockResolvedValueOnce(insertResult());

    const write = jest.fn();
    global.app = {
      locals: {
        activityConnections: new Map([[7, { write }]]),
      },
    };

    await logActivity(baseActivity);

    expect(write.mock.calls[0][0].startsWith('data: ')).toBe(true);
    expect(write.mock.calls[0][0].endsWith('\n\n')).toBe(true);
  });

  test('does not broadcast when the user has no SSE connection', async () => {
    db.query.mockResolvedValueOnce(insertResult());

    const write = jest.fn();
    global.app = {
      locals: {
        activityConnections: new Map([[99, { write }]]), // different user
      },
    };

    await logActivity(baseActivity);

    expect(write).not.toHaveBeenCalled();
  });

  test('skips broadcasting when app context is absent', async () => {
    db.query.mockResolvedValueOnce(insertResult());

    await expect(logActivity(baseActivity)).resolves.toEqual({
      activity_id: 101,
      activity_date: '2026-09-01T10:00:00Z',
    });
  });

  test('still returns the activity when the broadcast write fails', async () => {
    db.query.mockResolvedValueOnce(insertResult());

    global.app = {
      locals: {
        activityConnections: new Map([[7, { write: () => { throw new Error('stream closed'); } }]]),
      },
    };

    const result = await logActivity(baseActivity);

    expect(result.activity_id).toBe(101);
  });

  test('rethrows database errors', async () => {
    db.query.mockRejectedValueOnce(new Error('insert failed'));

    await expect(logActivity(baseActivity)).rejects.toThrow('insert failed');
  });
});
