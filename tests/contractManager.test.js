// tests/contractManager.test.js — unit tests for contract expiry and availability logic
jest.mock('../config/database', () => ({
  pool: { query: jest.fn(), connect: jest.fn(), end: jest.fn() },
  testConnection: jest.fn().mockResolvedValue(false),
  query: jest.fn()
}));

const db = require('../config/database');
const {
  updateExpiredContracts,
  checkFreelancerAvailability,
  getExpiredContracts
} = require('../utils/contractManager');

describe('updateExpiredContracts', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('reports the updated count when contracts expired', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ updated_count: '3' }] })
      // audit-details query runs when count > 0
      .mockResolvedValueOnce({ rows: [{ hire_id: 1, freelancer_id: 7 }] });

    const result = await updateExpiredContracts();

    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('update_expired_contracts()')
    );
    expect(result.success).toBe(true);
    expect(result.updated_count).toBe(3);
    expect(result.message).toBe('Updated 3 expired contracts');
  });

  test('returns zero count when nothing expired', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ updated_count: '0' }] });

    const result = await updateExpiredContracts();

    expect(result.success).toBe(true);
    expect(result.updated_count).toBe(0);
    expect(result.message).toBe('No expired contracts found');
    // The detail query for audit logging should not run
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('fetches audit details when contracts were updated', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ updated_count: '2' }] })
      .mockResolvedValueOnce({
        rows: [
          { hire_id: 1, freelancer_id: 7 },
          { hire_id: 2, freelancer_id: 8 }
        ]
      });

    await updateExpiredContracts();

    expect(db.query).toHaveBeenCalledTimes(2);
    const detailCall = db.query.mock.calls[1][0];
    expect(detailCall).toContain('actual_end_date = CURRENT_DATE');
    expect(detailCall).toContain('expected_end_date < CURRENT_DATE');
  });

  test('returns failure object on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('connection lost'));

    const result = await updateExpiredContracts();

    expect(result.success).toBe(false);
    expect(result.updated_count).toBe(0);
    expect(result.error).toBe('connection lost');
  });
});

describe('checkFreelancerAvailability', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('is available when there are no active contracts', async () => {
    // updateExpiredContracts call, then the availability query
    db.query
      .mockResolvedValueOnce({ rows: [{ updated_count: '0' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await checkFreelancerAvailability(5);

    expect(result.success).toBe(true);
    expect(result.is_available).toBe(true);
    expect(result.active_contracts).toEqual([]);
    expect(result.message).toBe('Freelancer is available for hiring');
  });

  test('is unavailable when an active, unexpired contract exists', async () => {
    const activeContract = {
      hire_id: 42,
      project_title: 'Build Website',
      expected_end_date: '2026-12-31',
      status: 'active'
    };
    db.query
      .mockResolvedValueOnce({ rows: [{ updated_count: '0' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [activeContract] });

    const result = await checkFreelancerAvailability(5);

    expect(result.is_available).toBe(false);
    expect(result.active_contracts).toEqual([activeContract]);
    expect(result.message).toBe('Freelancer has active contracts');
  });

  test('updates expired contracts before checking availability', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ updated_count: '0' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await checkFreelancerAvailability(9);

    // First call must be the expiry update, second the availability check
    expect(db.query.mock.calls[0][0]).toContain('update_expired_contracts()');
    expect(db.query.mock.calls[1][0]).toContain('freelancer_id = $1');
    expect(db.query.mock.calls[1][1]).toEqual([9]);
  });

  test('filters to active contracts that have not expired', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ updated_count: '0' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await checkFreelancerAvailability(5);

    const availabilityQuery = db.query.mock.calls[1][0];
    expect(availabilityQuery).toContain(`status = 'active'`);
    expect(availabilityQuery).toContain('expected_end_date IS NULL OR expected_end_date > CURRENT_DATE');
  });

  test('returns failure object on database error', async () => {
    // The expiry update succeeds, the availability query fails
    db.query
      .mockResolvedValueOnce({ rows: [{ updated_count: '0' }] })
      .mockRejectedValueOnce(new Error('connection lost'));

    const result = await checkFreelancerAvailability(5);

    expect(result.success).toBe(false);
    expect(result.is_available).toBe(false);
    expect(result.error).toBe('connection lost');
  });
});

describe('getExpiredContracts', () => {
  beforeEach(() => {
    db.query.mockReset();
  });

  test('returns expired contracts for the freelancer', async () => {
    const expired = [
      { hire_id: 10, project_title: 'Old Project', status: 'active' }
    ];
    db.query.mockResolvedValueOnce({ rows: expired, rowCount: 1 });

    const result = await getExpiredContracts(5);

    expect(result.success).toBe(true);
    expect(result.expired_contracts).toEqual(expired);
    expect(result.count).toBe(1);
    expect(db.query.mock.calls[0][1]).toEqual([5]);
  });

  test('returns empty list when freelancer has no expired contracts', async () => {
    db.query.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const result = await getExpiredContracts(5);

    expect(result.success).toBe(true);
    expect(result.expired_contracts).toEqual([]);
    expect(result.count).toBe(0);
  });

  test('returns failure object on database error', async () => {
    db.query.mockRejectedValueOnce(new Error('connection lost'));

    const result = await getExpiredContracts(5);

    expect(result.success).toBe(false);
    expect(result.expired_contracts).toEqual([]);
    expect(result.error).toBe('connection lost');
  });
});
