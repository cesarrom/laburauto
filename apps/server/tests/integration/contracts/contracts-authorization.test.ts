import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import { users, contractTemplates, contractInstances } from '@laburauto/shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const authHeaderFor = (userId: number, role: string) => ({
  Authorization: `Bearer ${jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1h' })}`,
});

describe('Contracts authorization boundaries', () => {
  let app: any;
  let db: any;

  let publisher: any;
  let renter: any;
  let outsider: any;
  let admin: any;

  let instanceId: number;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    db = setup.db;
    app = (await import('../../../src/app')).default;

    [publisher] = await db.insert(users).values({
      name: 'Publisher Owner',
      email: 'contracts-owner@test.com',
      password: 'password123',
      role: 'publisher',
      onboardingCompleted: true,
      subscriptionStatus: 'active',
    }).returning();

    [renter] = await db.insert(users).values({
      name: 'Renter Participant',
      email: 'contracts-renter@test.com',
      password: 'password123',
      role: 'driver',
      onboardingCompleted: true,
    }).returning();

    [outsider] = await db.insert(users).values({
      name: 'Outsider User',
      email: 'contracts-outsider@test.com',
      password: 'password123',
      role: 'driver',
      onboardingCompleted: true,
    }).returning();

    [admin] = await db.insert(users).values({
      name: 'Admin User',
      email: 'contracts-admin@test.com',
      password: 'password123',
      role: 'admin',
      onboardingCompleted: true,
    }).returning();

    const [template] = await db.insert(contractTemplates).values({
      name: 'Authorization Test Template',
      type: 'rental_agreement',
      pdfUrl: 'http://example.com/template.pdf',
      fields: [],
      stages: [{ id: 'st_publisher', type: 'signer', role: 'publisher' }],
      variableSchema: {},
    }).returning();

    const [instance] = await db.insert(contractInstances).values({
      templateId: template.id,
      status: 'pending',
      publisherId: publisher.id,
      renterId: renter.id,
      variableValues: {},
      stage1CompletedAt: new Date(),
      stage1CompletedBy: null,
      auditLog: [],
    }).returning();

    instanceId = instance.id;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('blocks non-participants from reading contract instances', async () => {
    const outsiderRes = await request(app)
      .get(`/api/contracts/instances/${instanceId}`)
      .set(authHeaderFor(outsider.id, 'driver'));

    expect(outsiderRes.status).toBe(403);

    const participantRes = await request(app)
      .get(`/api/contracts/instances/${instanceId}`)
      .set(authHeaderFor(publisher.id, 'publisher'));

    expect(participantRes.status).toBe(200);
  });

  it('blocks non-participants from signing contract instances', async () => {
    const outsiderRes = await request(app)
      .post(`/api/contracts/instances/${instanceId}/sign`)
      .set(authHeaderFor(outsider.id, 'driver'))
      .send({
        auditEvent: {
          isFinal: false,
          userId: outsider.id,
          action: 'signed',
          timestamp: new Date().toISOString(),
        },
      });

    expect(outsiderRes.status).toBe(403);
  });

  it('requires auth and ownership/admin for invitation resend', async () => {
    const noAuthRes = await request(app)
      .post(`/api/contracts/instances/${instanceId}/resend-invitation`)
      .send({});

    expect(noAuthRes.status).toBe(401);

    const outsiderRes = await request(app)
      .post(`/api/contracts/instances/${instanceId}/resend-invitation`)
      .set(authHeaderFor(outsider.id, 'driver'))
      .send({});

    expect(outsiderRes.status).toBe(403);

    // Admin should be allowed through authorization guard.
    const adminRes = await request(app)
      .post(`/api/contracts/instances/${instanceId}/resend-invitation`)
      .set(authHeaderFor(admin.id, 'admin'))
      .send({});

    expect([200, 500]).toContain(adminRes.status);
  });

  it('allows only admins to manage templates', async () => {
    const nonAdminListRes = await request(app)
      .get('/api/contracts/templates')
      .set(authHeaderFor(outsider.id, 'driver'));

    expect(nonAdminListRes.status).toBe(403);

    const adminListRes = await request(app)
      .get('/api/contracts/templates')
      .set(authHeaderFor(admin.id, 'admin'));

    expect(adminListRes.status).toBe(200);
    expect(Array.isArray(adminListRes.body)).toBe(true);
  });

  it('enforces workflow rules for the two supported template types', async () => {
    const invalidEnrollment = await request(app)
      .post('/api/contracts/templates')
      .set(authHeaderFor(admin.id, 'admin'))
      .send({
        name: 'Invalid Enrollment',
        type: 'publisher_enrollment',
        pdfUrl: 'http://example.com/enrollment.pdf',
        fields: [],
        stages: [
          { id: 'stage_pub', type: 'signer', role: 'publisher' },
          { id: 'stage_extra', type: 'signer', role: 'renter' },
        ],
      });

    expect(invalidEnrollment.status).toBe(400);

    const invalidRental = await request(app)
      .post('/api/contracts/templates')
      .set(authHeaderFor(admin.id, 'admin'))
      .send({
        name: 'Invalid Rental',
        type: 'rental_agreement',
        pdfUrl: 'http://example.com/rental.pdf',
        fields: [],
        stages: [
          { id: 'stage_pub', type: 'signer', role: 'publisher' },
        ],
      });

    expect(invalidRental.status).toBe(400);

    const validRental = await request(app)
      .post('/api/contracts/templates')
      .set(authHeaderFor(admin.id, 'admin'))
      .send({
        name: 'Valid Rental',
        type: 'rental_agreement',
        pdfUrl: 'http://example.com/rental-valid.pdf',
        fields: [],
        stages: [
          { id: 'stage_pub', type: 'signer', role: 'publisher' },
          { id: 'stage_renter', type: 'signer', role: 'renter' },
        ],
      });

    expect(validRental.status).toBe(201);
  });

  it('requires valid webhook secret for Docuseal webhooks', async () => {
    process.env.DOCUSEAL_WEBHOOK_SECRET = 'test-docuseal-secret';

    const invalidRes = await request(app)
      .post('/api/contracts/docuseal/webhook')
      .send({ event: 'submission.completed', external_id: `contract-instance-${instanceId}` });

    expect(invalidRes.status).toBe(401);

    const validRes = await request(app)
      .post('/api/contracts/docuseal/webhook')
      .set('x-docuseal-secret', 'test-docuseal-secret')
      .send({ event: 'submission.completed', external_id: `contract-instance-${instanceId}`, role: 'publisher' });

    expect(validRes.status).toBe(200);
  });

  it('returns guard error when Docuseal API key is not configured', async () => {
    delete process.env.DOCUSEAL_API_KEY;
    process.env.DOCUSEAL_ENABLED = 'true';

    const res = await request(app)
      .post(`/api/contracts/instances/${instanceId}/docuseal-submission`)
      .set(authHeaderFor(admin.id, 'admin'))
      .send({});

    expect(res.status).toBe(400);
    expect(String(res.body.error || '')).toContain('not configured');
  });
});
