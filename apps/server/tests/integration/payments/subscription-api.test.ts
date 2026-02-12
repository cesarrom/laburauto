import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../../src/app';

// Mock dLocal service first
vi.mock('../../../src/services/dlocal', async () => {
  return await import('../../mocks/dlocal');
});

// Use vi.hoisted to ensure mockDb is available for the mock factory
const { mockDb } = vi.hoisted(() => {
  const mock = {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ id: 1 }]),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]), // Default empty
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn().mockResolvedValue({}),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue({}),
    })),
  };
  return { mockDb: mock };
});

vi.mock('../../../src/db', () => ({
  db: mockDb,
}));

// Mock User Data
const mockUser = {
  id: 1,
  email: 'test@example.com',
  subscriptionStatus: 'inactive',
  subscriptionId: null,
};

describe('Payment Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default behavior for select
    mockDb.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    }));
  });

  describe('POST /api/payments/subscribe', () => {
    it('should return subscription URL for valid user', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(mockUser);

      const res = await request(app)
        .post('/api/payments/subscribe')
        .send({ userId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.url).toContain('https://checkout.dlocalgo.com');
      expect(res.body.url).toContain('email=test%40example.com');
    });

    it('should return 400 if user already subscribed', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({ ...mockUser, subscriptionStatus: 'active' });

      const res = await request(app)
        .post('/api/payments/subscribe')
        .send({ userId: 1 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('ALREADY_SUBSCRIBED');
    });

    it('should return 404 if user not found', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/payments/subscribe')
        .send({ userId: 999 });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/payments/verify', () => {
    it('should confirm active status from DB', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({ ...mockUser, subscriptionStatus: 'active' });

      const res = await request(app)
        .post('/api/payments/verify')
        .send({ userId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
      expect(res.body.source).toBe('database');
    });

    it('should check API if DB is inactive', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({ ...mockUser, subscriptionStatus: 'inactive' });
      // The dlocal mock returns 'active' by default

      const res = await request(app)
        .post('/api/payments/verify')
        .send({ userId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('active');
      expect(res.body.source).toBe('api');
      expect(mockDb.update).toHaveBeenCalled(); // Should update DB
    });
  });

  describe('POST /api/payments/subscriptions/cancel', () => {
    it('should cancel subscription and cleanup', async () => {
      mockDb.query.users.findFirst.mockResolvedValue({ ...mockUser, subscriptionId: 'sub_123' });

      // Explicitly mock select to return vehicles for this test logic
      mockDb.select.mockImplementation(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([{ id: 99 }]), // Return one vehicle
        })),
      }));

      const res = await request(app)
        .post('/api/payments/subscriptions/cancel')
        .send({
          userId: 1,
          confirmation: 'CANCEL SUBSCRIPTION AND DELETE ALL VEHICLES'
        });

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled(); // Status update
      expect(mockDb.delete).toHaveBeenCalled(); // Cascading delete
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('should update user status on valid webhook', async () => {
      const webhookPayload = {
        external_id: '1',
        status: 'PAID',
        subscription_id: 'sub_new',
      };

      const res = await request(app)
        .post('/api/payments/webhook')
        .send(webhookPayload);

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
