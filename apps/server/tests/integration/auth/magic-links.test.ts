import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

// Unmock the service to use real implementation (integration test)
vi.unmock('../../../src/services/magicLinkService');

import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import { users, magicLinks, auditLogs } from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';
import express from 'express';

// Mock DB
let currentTestDb: any;
vi.mock('../../../src/db', () => ({
  db: new Proxy({}, {
    get: (_target, prop) => {
      if (!currentTestDb) throw new Error('Test DB not initialized');
      return currentTestDb[prop];
    }
  })
}));

import authRouter from '../../../src/routes/auth';
import { MagicLinkService } from '../../../src/services/magicLinkService';

describe('Magic Link Integration', () => {
  let app: express.Express;
  let db: any;

  beforeEach(async () => {
    ({ db } = await setupTestDatabase());
    currentTestDb = db;

    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
  });

  afterEach(async () => {
    await teardownTestDatabase();
    currentTestDb = null;
  });

  it('should generate and consume a magic link', async () => {
    // Create a user
    const [user] = await db.insert(users).values({
      name: 'Magic User',
      email: 'magic@example.com',
      password: 'hash',
      role: 'driver'
    }).returning();

    // Generate link
    const redirectPath = '/test-path';
    const linkUrl = await MagicLinkService.createLink(user.id, redirectPath);

    expect(linkUrl).toContain('/magic-login?token=');
    const token = linkUrl.split('token=')[1];

    // Verify Audit Log for generation
    const genLogs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'auth.magic_link_generated'));
    expect(genLogs.length).toBe(1);
    expect(genLogs[0].userId).toBe(user.id);

    // Consume link via API
    const res = await request(app).post('/auth/magic-login').send({ token });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined(); // JWT
    expect(res.body.user.email).toBe('magic@example.com');
    expect(res.body.redirectPath).toBe(redirectPath);

    // Verify marked as used
    const [link] = await db.select().from(magicLinks).where(eq(magicLinks.token, token));
    expect(link.usedAt).not.toBeNull();

    // Verify Audit Log for consumption
    const consLogs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'auth.magic_link_consumed'));
    expect(consLogs.length).toBe(1);
    expect(consLogs[0].userId).toBe(user.id);
  });

  it('should fail for expired tokens', async () => {
    const [user] = await db.insert(users).values({
      name: 'Expired User',
      email: 'expired@example.com',
      password: 'hash'
    }).returning();

    // Insert manually expired token
    const token = 'expired-token';
    const pastDate = new Date();
    pastDate.setMinutes(pastDate.getMinutes() - 20);

    await db.insert(magicLinks).values({
      userId: user.id,
      token,
      expiresAt: pastDate,
      redirectPath: '/'
    });

    const res = await request(app).post('/auth/magic-login').send({ token });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('expired');
  });

  it('should fail for already used tokens', async () => {
    const [user] = await db.insert(users).values({
      name: 'Used User',
      email: 'used@example.com',
      password: 'hash'
    }).returning();

    const token = 'used-token';
    const futureDate = new Date();
    futureDate.setMinutes(futureDate.getMinutes() + 20);

    await db.insert(magicLinks).values({
      userId: user.id,
      token,
      expiresAt: futureDate,
      usedAt: new Date(),
      redirectPath: '/'
    });

    const res = await request(app).post('/auth/magic-login').send({ token });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('used');
  });
});
