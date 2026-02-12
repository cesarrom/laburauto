import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import { users, auditLogs } from '@laburauto/shared/schema';
import { eq, desc } from 'drizzle-orm';
import { Request } from 'express';

// 1. Mock DB Module
let currentTestDb: any;
vi.mock('../../../src/db', () => ({
  db: new Proxy({}, {
    get: (_target, prop) => {
      if (!currentTestDb) throw new Error('Test DB not initialized');
      return currentTestDb[prop];
    }
  })
}));

// 2. Import Service AFTER Mock
import { AuditService } from '../../../src/services/auditService';

describe('Audit Trail System', () => {
  let db: any;

  beforeEach(async () => {
    ({ db } = await setupTestDatabase());
    currentTestDb = db;
  });

  afterEach(async () => {
    await teardownTestDatabase();
    currentTestDb = null;
  });

  it('should record an audit log with correct metadata', async () => {
    // Setup User
    const [user] = await db.insert(users).values({
      name: 'Audit Tester',
      email: 'audit@example.com',
      password: 'password',
      role: 'admin',
    }).returning();

    // Mock Request
    const mockReq = {
      ip: '192.168.1.100',
      headers: {
        'user-agent': 'Mozilla/5.0 (Test)',
      },
      socket: { remoteAddress: '192.168.1.100' }
    } as unknown as Request;

    // Perform Action
    await AuditService.log(
      user.id,
      'test.action',
      'user_profile',
      user.id,
      { field: 'reputation', oldValue: 100, newValue: 105 },
      mockReq
    );

    // Verify
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.userId, user.id));
    expect(logs).toHaveLength(1);

    const log = logs[0];
    expect(log.action).toBe('test.action');
    expect(log.entityType).toBe('user_profile');
    expect(log.entityId).toBe(user.id);

    // Check Metadata
    const metadata = log.metadata as any;
    expect(metadata.ip).toBe('192.168.1.100');
    expect(metadata.userAgent).toBe('Mozilla/5.0 (Test)');
    expect(metadata.timestamp).toBeDefined();

    // Check Details
    const details = log.details as any;
    expect(details.oldValue).toBe(100);
    expect(details.newValue).toBe(105);
  });

  it('should handle anonymous actions (null userId)', async () => {
    const mockReq = { ip: '10.0.0.1', headers: {} } as Request;

    await AuditService.log(
      null,
      'system.cron',
      'booking',
      999,
      { reason: 'expired' },
      mockReq
    );

    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.id));
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].userId).toBeNull();
    expect(logs[0].action).toBe('system.cron');
    expect((logs[0].metadata as any).ip).toBe('10.0.0.1');
  });
});
