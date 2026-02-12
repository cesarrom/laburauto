
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import * as schema from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';
import {
  ensureUser,
  loginUser,
  createContractTemplate,
  makeAdmin,
  signContract
} from '../../helpers/api-utils';
import request from 'supertest';

describe('Publisher Enrollment Flow', () => {
  let app: any;
  let db: any;
  let admin: any;

  beforeAll(async () => {
    const result = await setupTestDatabase();
    db = result.db;
    app = (await import('../../../src/app')).default;

    // Setup Admin and Template
    const adminRes = await ensureUser(app, { name: 'Admin', email: 'admin-enroll@test.com', password: 'password123' });
    await makeAdmin(db, adminRes.user.id);
    admin = await loginUser(app, { email: 'admin-enroll@test.com', password: 'password123' });

    await createContractTemplate(app, admin.token, {
      name: 'Publisher Enrollment Agreement',
      type: 'publisher_enrollment',
      pdfUrl: 'http://example.com/agreement.pdf',
      fields: [{ id: 'sig', type: 'signature', label: 'Sign Here', page: 1, x: 100, y: 100, width: 100, height: 50 }],
      stages: [{ id: 'st_publisher', label: 'Publisher Sign', type: 'signer', role: 'publisher' }]
    });
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  it('should require contract signature for publisher onboarding', async () => {
    // 1. Register User
    const user = await ensureUser(app, { name: 'New Publisher', email: 'newpub@test.com', password: 'password123' });

    // 2. Complete Onboarding with Publisher Role
    const kycData = JSON.stringify({ fullName: 'New Publisher', idNumber: '12345678', address: '123 St' });
    const res = await request(app)
      .post('/api/auth/complete-onboarding')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        userId: user.user.id,
        role: 'publisher',
        kycData
      });

    expect(res.status).toBe(200);
    // CRITICAL: Onboarding should NOT be complete yet
    expect(res.body.user.onboardingCompleted).toBe(false);
    expect(res.body.user.role).toBe('publisher');

    // Check DB state
    const dbUser = await db.query.users.findFirst({ where: eq(schema.users.id, user.user.id) });
    expect(dbUser.onboardingCompleted).toBe(false);
    expect(dbUser.enrollmentContractId).toBeDefined();

    // 3. User Returns (Resume Flow Check)
    // The user should validly have role='publisher' but onboardingCompleted=false
    const loginRes = await loginUser(app, { email: 'newpub@test.com', password: 'password123' });
    expect(loginRes.user.role).toBe('publisher');
    expect(loginRes.user.onboardingCompleted).toBe(false);

    // 4. Sign Contract
    const contractId = dbUser.enrollmentContractId;

    // Use Generic Sign Endpoint (as per enrollment flow)
    const signRes = await request(app)
      .post(`/api/contracts/instances/${contractId}/sign`)
      .set('Authorization', `Bearer ${loginRes.token}`)
      .send({
        fields: { sig: 'signed_data' },
        auditEvent: { isFinal: true, userId: user.user.id, action: 'signed', timestamp: new Date().toISOString() }
      });

    expect(signRes.status).toBe(200);
    expect(signRes.body.status).toBe('signed');

    // 5. Verify Onboarding Complete
    const finalUser = await db.query.users.findFirst({ where: eq(schema.users.id, user.user.id) });
    expect(finalUser.onboardingCompleted).toBe(true);

    // 6. Verify Email Attachment
    const { mockSentEmails } = await import('../../../src/services/emailService');
    const completionEmail = mockSentEmails.find(e => e.to.includes(user.user.email) && e.subject.includes('Signed Contract'));

    expect(completionEmail).toBeDefined();
    expect(completionEmail.hasAttachment).toBe(true);
  });
});
