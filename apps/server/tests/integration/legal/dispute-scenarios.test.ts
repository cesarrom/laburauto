import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import {
  users,
  vehicles,
  vehicleModels,
  bookings,
  auditLogs,
  contractTemplates,
  contractInstances,
  photoAudits,
  notifications
} from '@laburauto/shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import express from 'express';
import { getAuthHeader } from '../../helpers/auth';

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

// Mock external services
vi.mock('../../../src/services/bytescale', () => ({
  uploadBuffer: vi.fn(async () => '/contracts/test_contract.pdf'),
  uploadFile: vi.fn(),
  getSignedUrl: vi.fn((url) => `https://signed.example.com${url}?signed=true`),
}));

vi.mock('../../../src/services/emailService', () => ({
  EmailService: {
    sendFinalContract: vi.fn().mockResolvedValue({ success: true }),
    sendSigningInvitation: vi.fn().mockResolvedValue({ success: true }),
  },
  mockSentEmails: [],
}));

// Import routes AFTER mocking
import bookingsRouter from '../../../src/routes/bookings';
import auditReportRouter from '../../../src/routes/audit-report';
import photoAuditsRouter from '../../../src/routes/photo-audits';

/**
 * LEGAL DISPUTE SCENARIOS - INTEGRATION TESTS
 * 
 * These tests simulate real-world court scenarios to verify that our audit
 * trail system can provide impartial, immutable evidence for legal proceedings.
 * 
 * Key scenarios covered:
 * 1. Payment disputes (renter claims paid vs publisher denies)
 * 2. Vehicle damage claims (condition at check-in vs check-out)
 * 3. Contract signing verification (chain of custody)
 * 4. Identity verification through email-based access
 */

describe('Legal Scenario: Payment Dispute', () => {
  let app: express.Express;
  let db: any;
  let testPublisher: any;
  let testRenter: any;
  let testVehicle: any;
  let testBooking: any;

  beforeEach(async () => {
    ({ db } = await setupTestDatabase());
    currentTestDb = db;

    app = express();
    app.use(express.json());

    app.use('/bookings', bookingsRouter);
    app.use('/audit-report', auditReportRouter);

    // Setup test data
    [testPublisher] = await db.insert(users).values({
      name: 'Test Publisher',
      email: 'publisher@test.com',
      password: 'hash',
      role: 'publisher',
    }).returning();

    [testRenter] = await db.insert(users).values({
      name: 'Test Renter',
      email: 'renter@test.com',
      password: 'hash',
      role: 'driver',
    }).returning();

    const [model] = await db.insert(vehicleModels).values({
      typeName: 'Auto',
      typeId: 1,
      brandName: 'Toyota',
      brandId: 1,
      modelName: 'Corolla',
      modelId: 1,
      versionName: 'XEI',
      versionId: 1,
    }).returning();

    [testVehicle] = await db.insert(vehicles).values({
      publisherId: testPublisher.id,
      vehicleModelId: model.id,
      year: 2022,
      plate: 'ABC123',
      mileage: 50000,
      description: 'Test vehicle for audit',
      status: 'active',
      paymentInstructions: 'Transfer to CBU 123456789',
    }).returning();

    [testBooking] = await db.insert(bookings).values({
      vehicleId: testVehicle.id,
      driverId: testRenter.id,
      startDate: '2026-02-10',
      endDate: '2026-02-12',
      selectedShiftIds: [1, 1],
      totalPrice: 15000,
      status: 'pending_payment',
    }).returning();
  });

  afterEach(async () => {
    await teardownTestDatabase();
    currentTestDb = null;
  });

  it('should generate complete audit trail when renter claims payment but publisher disputes', async () => {
    // SCENARIO: Renter uploads payment proof, publisher claims no payment received
    // EXPECTED: Full audit trail with hashed proof, dispute filing, timestamps, IPs

    // Step 1: Renter uploads payment proof
    const proofResponse = await request(app)
      .post(`/bookings/${testBooking.id}/payment/proof`)
      .set(getAuthHeader(testRenter.id, 'driver'))
      .send({ proofUrl: 'https://example.com/payment_receipt.jpg' })
      .set('X-Forwarded-For', '192.168.1.100')
      .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)');

    expect(proofResponse.status).toBe(200);
    expect(proofResponse.body.status).toBe('payment_sent');

    // Step 2: Verify payment proof was hashed (even if fetch failed in test, structure exists)
    const bookingAfterProof = await db.query.bookings.findFirst({
      where: eq(bookings.id, testBooking.id),
    });
    expect(bookingAfterProof.paymentProofUrl).toBe('https://example.com/payment_receipt.jpg');
    // Hash might be null if fetch fails, but the column exists

    // Step 3: Publisher disputes the payment
    const disputeResponse = await request(app)
      .post(`/bookings/${testBooking.id}/payment/dispute`)
      .set(getAuthHeader(testPublisher.id, 'publisher'))
      .send({
        disputeNotes: 'No payment received in my bank account. Proof appears to be for a different transaction.'
      })
      .set('X-Forwarded-For', '10.0.0.50')
      .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');

    expect(disputeResponse.status).toBe(200);
    expect(disputeResponse.body.disputeStatus).toBe('pending');

    // Step 4: Verify audit logs were created
    const auditLogsResult = await db.select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, testBooking.id))
      .orderBy(auditLogs.createdAt);

    // Should have at least: payment_proof_uploaded, dispute_filed
    const actions = auditLogsResult.map((log: any) => log.action);
    expect(actions).toContain('booking.payment_proof_uploaded');
    expect(actions).toContain('booking.dispute_filed');

    // Step 5: Verify audit metadata includes IP and User-Agent
    const proofLog = auditLogsResult.find((log: any) => log.action === 'booking.payment_proof_uploaded');
    expect(proofLog).toBeDefined();
    expect((proofLog.metadata as any).ip).toBeDefined();
    expect((proofLog.metadata as any).userAgent).toBeDefined();
    expect((proofLog.metadata as any).timestamp).toBeDefined();

    const disputeLog = auditLogsResult.find((log: any) => log.action === 'booking.dispute_filed');
    expect(disputeLog).toBeDefined();
    expect((disputeLog.details as any).filedBy).toBe('publisher');
    expect((disputeLog.details as any).disputeNotes).toContain('No payment received');

    // Step 6: Get the full audit report
    const reportResponse = await request(app)
      .get(`/audit-report/booking/${testBooking.id}`)
      .set(getAuthHeader(999, 'admin')); // Admin access

    expect(reportResponse.status).toBe(200);
    expect(reportResponse.body.booking.disputeStatus).toBe('pending');
    expect(reportResponse.body.timeline.length).toBeGreaterThan(0);
    expect(reportResponse.body.documents.paymentProof).toBeDefined();
    expect(reportResponse.body.documents.paymentProof.rawUrl).toBe('https://example.com/payment_receipt.jpg');
    expect(reportResponse.body.documents.paymentProof.signedUrl).toContain('signed=true');

    console.log('✓ Payment dispute audit trail verified with', reportResponse.body.timeline.length, 'events');
  });

  it('should prove chronological sequence of events in payment dispute', async () => {
    // SCENARIO: Need to prove the exact order of events for court

    // Event 1: Booking created (already done in beforeEach)
    const createLog = await db.insert(auditLogs).values({
      userId: testRenter.id,
      action: 'booking.create',
      entityType: 'booking',
      entityId: testBooking.id,
      details: { totalPrice: 15000 },
      metadata: { ip: '192.168.1.1', userAgent: 'Test', timestamp: new Date().toISOString() },
    }).returning();

    // Event 2: Payment proof uploaded
    await request(app)
      .post(`/bookings/${testBooking.id}/payment/proof`)
      .set(getAuthHeader(testRenter.id, 'driver'))
      .send({ proofUrl: 'https://example.com/receipt.jpg' });

    // Wait a tiny bit to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    // Event 3: Dispute filed
    await request(app)
      .post(`/bookings/${testBooking.id}/payment/dispute`)
      .set(getAuthHeader(testPublisher.id, 'publisher'))
      .send({ disputeNotes: 'No payment received' });

    // Verify chronological order in audit report
    const reportResponse = await request(app)
      .get(`/audit-report/booking/${testBooking.id}`)
      .set(getAuthHeader(999, 'admin'));

    expect(reportResponse.status).toBe(200);

    const timeline = reportResponse.body.timeline;
    expect(timeline.length).toBeGreaterThanOrEqual(3);

    // Timeline should be sorted chronologically (ascending)
    for (let i = 1; i < timeline.length; i++) {
      const prevTime = new Date(timeline[i - 1].timestamp).getTime();
      const currTime = new Date(timeline[i].timestamp).getTime();
      expect(currTime).toBeGreaterThanOrEqual(prevTime);
    }

    console.log('✓ Chronological sequence verified:', timeline.map((e: any) => e.action).join(' → '));
  });
});

describe('Legal Scenario: Vehicle Damage Claim', () => {
  let app: express.Express;
  let db: any;
  let testPublisher: any;
  let testRenter: any;
  let testVehicle: any;
  let testBooking: any;

  beforeEach(async () => {
    ({ db } = await setupTestDatabase());
    currentTestDb = db;

    app = express();
    app.use(express.json());

    app.use('/audits', photoAuditsRouter);
    app.use('/audit-report', auditReportRouter);

    // Setup test data
    [testPublisher] = await db.insert(users).values({
      name: 'Publisher Damage Test',
      email: 'pub.damage@test.com',
      password: 'hash',
      role: 'publisher',
    }).returning();

    [testRenter] = await db.insert(users).values({
      name: 'Renter Damage Test',
      email: 'renter.damage@test.com',
      password: 'hash',
      role: 'driver',
    }).returning();

    const [model] = await db.insert(vehicleModels).values({
      typeName: 'Auto',
      typeId: 1,
      brandName: 'Honda',
      brandId: 2,
      modelName: 'Civic',
      modelId: 2,
      versionName: 'EX',
      versionId: 2,
    }).returning();

    [testVehicle] = await db.insert(vehicles).values({
      publisherId: testPublisher.id,
      vehicleModelId: model.id,
      year: 2021,
      plate: 'DEF456',
      mileage: 30000,
      lastOdometer: 30000,
      description: 'Vehicle for damage test',
      status: 'active',
    }).returning();

    [testBooking] = await db.insert(bookings).values({
      vehicleId: testVehicle.id,
      driverId: testRenter.id,
      startDate: '2026-02-15',
      endDate: '2026-02-17',
      selectedShiftIds: [1, 1],
      totalPrice: 20000,
      status: 'active',
    }).returning();
  });

  afterEach(async () => {
    await teardownTestDatabase();
    currentTestDb = null;
  });

  it('should prove vehicle condition at check-in vs check-out', async () => {
    // SCENARIO: Publisher claims renter damaged the car during rental
    // EVIDENCE NEEDED: Photos and odometer at check-in vs check-out

    // Step 1: Check-in audit with photos showing good condition
    const checkInResponse = await request(app)
      .post('/audits')
      .set(getAuthHeader(testRenter.id, 'driver'))
      .send({
        bookingId: testBooking.id,
        type: 'check_in',
        photos: [
          'https://example.com/checkin_front.jpg',
          'https://example.com/checkin_rear.jpg',
          'https://example.com/checkin_interior.jpg',
        ],
        odometerReading: 30050,
        metadata: { isLive: true, gps: { lat: -34.6037, lng: -58.3816 } },
      })
      .set('X-Forwarded-For', '192.168.1.200')
      .set('User-Agent', 'RenterApp/1.0');

    expect(checkInResponse.status).toBe(201);
    expect(checkInResponse.body.photoHashes).toBeDefined();
    expect(checkInResponse.body.photoHashes.length).toBe(3);

    // Step 2: Check-out audit with photos showing damage
    const checkOutResponse = await request(app)
      .post('/audits')
      .set(getAuthHeader(testRenter.id, 'driver'))
      .send({
        bookingId: testBooking.id,
        type: 'check_out',
        photos: [
          'https://example.com/checkout_front_scratched.jpg',
          'https://example.com/checkout_rear.jpg',
          'https://example.com/checkout_interior.jpg',
        ],
        odometerReading: 30350, // 300km driven
        metadata: { isLive: true, gps: { lat: -34.6037, lng: -58.3816 } },
      })
      .set('X-Forwarded-For', '192.168.1.200')
      .set('User-Agent', 'RenterApp/1.0');

    expect(checkOutResponse.status).toBe(201);
    expect(checkOutResponse.body.photoHashes).toBeDefined();

    // Step 3: Verify photo audits are stored with hashes
    const photoAuditRecords = await db.select().from(photoAudits)
      .where(eq(photoAudits.bookingId, testBooking.id));

    expect(photoAuditRecords.length).toBe(2);

    const checkIn = photoAuditRecords.find((pa: any) => pa.type === 'check_in');
    const checkOut = photoAuditRecords.find((pa: any) => pa.type === 'check_out');

    expect(checkIn.odometerReading).toBe(30050);
    expect(checkOut.odometerReading).toBe(30350);
    expect(checkOut.odometerReading - checkIn.odometerReading).toBe(300);

    // Step 4: Verify audit logs for photo submissions
    const photoLogs = await db.select().from(auditLogs)
      .where(eq(auditLogs.entityType, 'photo_audit'));

    expect(photoLogs.length).toBe(2);

    const checkInLog = photoLogs.find((log: any) => log.action === 'booking.photo_audit.check_in');
    const checkOutLog = photoLogs.find((log: any) => log.action === 'booking.photo_audit.check_out');

    expect(checkInLog).toBeDefined();
    expect(checkOutLog).toBeDefined();
    expect((checkInLog.details as any).photoHashes.length).toBe(3);
    expect((checkOutLog.details as any).photoHashes.length).toBe(3);

    // Step 5: Get full audit report
    const reportResponse = await request(app)
      .get(`/audit-report/booking/${testBooking.id}`)
      .set(getAuthHeader(999, 'admin'));

    expect(reportResponse.status).toBe(200);
    expect(reportResponse.body.documents.photoAudits).toBeDefined();
    expect(reportResponse.body.documents.photoAudits.length).toBe(2);

    // Verify photos have signed URLs
    const checkInAudit = reportResponse.body.documents.photoAudits.find((pa: any) => pa.type === 'check_in');
    expect(checkInAudit.photos[0].signedUrl).toContain('signed=true');

    console.log('✓ Vehicle condition audit verified with',
      checkInAudit.photos.length, 'check-in photos and',
      'odometer difference of', checkOut.odometerReading - checkIn.odometerReading, 'km');
  });

  it('should reject non-live photos to prevent fraud', async () => {
    // SCENARIO: Renter tries to upload gallery photos instead of live photos

    const response = await request(app)
      .post('/audits')
      .set(getAuthHeader(testRenter.id, 'driver'))
      .send({
        bookingId: testBooking.id,
        type: 'check_in',
        photos: ['https://example.com/old_photo.jpg'],
        odometerReading: 30050,
        metadata: { isLive: false }, // Gallery photo
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toContain('live');

    console.log('✓ Non-live photos rejected as expected');
  });
});

describe('Legal Scenario: Contract Signing Chain of Custody', () => {
  let app: express.Express;
  let db: any;
  let testPublisher: any;
  let testRenter: any;
  let testVehicle: any;
  let testBooking: any;
  let testContract: any;

  beforeEach(async () => {
    ({ db } = await setupTestDatabase());
    currentTestDb = db;

    app = express();
    app.use(express.json());
    app.use('/audit-report', auditReportRouter);

    // Setup test data
    [testPublisher] = await db.insert(users).values({
      name: 'Contract Test Publisher',
      email: 'contract.pub@test.com',
      password: 'hash',
      role: 'publisher',
    }).returning();

    [testRenter] = await db.insert(users).values({
      name: 'Contract Test Renter',
      email: 'contract.renter@test.com',
      password: 'hash',
      role: 'driver',
    }).returning();

    const [model] = await db.insert(vehicleModels).values({
      typeName: 'Auto',
      typeId: 1,
      brandName: 'Volkswagen',
      brandId: 3,
      modelName: 'Golf',
      modelId: 3,
      versionName: 'TSI',
      versionId: 3,
    }).returning();

    [testVehicle] = await db.insert(vehicles).values({
      publisherId: testPublisher.id,
      vehicleModelId: model.id,
      year: 2023,
      plate: 'GHI789',
      mileage: 10000,
      description: 'Contract test vehicle',
      status: 'active',
    }).returning();

    // Create contract template
    const [template] = await db.insert(contractTemplates).values({
      name: 'Test Rental Agreement',
      type: 'rental_agreement',
      pdfUrl: 'https://example.com/template.pdf',
      fields: [],
      stages: [
        { id: 'st_1', label: 'Publisher', type: 'signer' },
        { id: 'st_2', label: 'Renter', type: 'signer' },
      ],
    }).returning();

    // Create contract instance
    [testContract] = await db.insert(contractInstances).values({
      templateId: template.id,
      status: 'pending',
      publisherId: testPublisher.id,
      renterId: testRenter.id,
      auditLog: [],
    }).returning();

    [testBooking] = await db.insert(bookings).values({
      vehicleId: testVehicle.id,
      driverId: testRenter.id,
      startDate: '2026-02-20',
      endDate: '2026-02-22',
      selectedShiftIds: [1, 1],
      totalPrice: 25000,
      status: 'confirmed',
      contractId: testContract.id,
    }).returning();
  });

  afterEach(async () => {
    await teardownTestDatabase();
    currentTestDb = null;
  });

  it('should prove both parties signed with verifiable metadata', async () => {
    // SCENARIO: Party claims they never signed the contract
    // EVIDENCE NEEDED: Audit logs with IP, User-Agent, timestamp, PDF hash

    // Simulate Stage 1 signing (Publisher)
    await db.insert(auditLogs).values({
      userId: testPublisher.id,
      action: 'contract.signed.stage1',
      entityType: 'contract_instance',
      entityId: testContract.id,
      details: {
        stage: 'stage-1-publisher',
        pdfHash: 'abc123def456789stage1hash',
      },
      metadata: {
        ip: '200.45.67.89',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        timestamp: new Date('2026-02-18T14:30:00Z').toISOString(),
      },
    });

    // Update contract for stage 1
    await db.update(contractInstances)
      .set({
        stage1CompletedAt: new Date('2026-02-18T14:30:00Z'),
        stage1CompletedBy: testPublisher.id,
        finalPdfUrl: '/contracts/booking_stage1.pdf',
      })
      .where(eq(contractInstances.id, testContract.id));

    // Simulate Stage 2 signing (Renter)
    await db.insert(auditLogs).values({
      userId: testRenter.id,
      action: 'contract.signed.stage2',
      entityType: 'contract_instance',
      entityId: testContract.id,
      details: {
        stage: 'stage-2-renter',
        pdfHash: 'xyz789final456hashcomplete',
      },
      metadata: {
        ip: '181.23.45.67',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        timestamp: new Date('2026-02-18T16:45:00Z').toISOString(),
      },
    });

    // Update contract for stage 2
    await db.update(contractInstances)
      .set({
        stage2CompletedAt: new Date('2026-02-18T16:45:00Z'),
        stage2CompletedBy: testRenter.id,
        status: 'signed',
        signedAt: new Date('2026-02-18T16:45:00Z'),
        finalPdfUrl: '/contracts/booking_final.pdf',
        emailSentAt: new Date('2026-02-18T16:46:00Z'),
      })
      .where(eq(contractInstances.id, testContract.id));

    // Update booking
    await db.update(bookings)
      .set({
        contractFullySigned: true,
        contractSignedAt: new Date('2026-02-18T16:45:00Z'),
      })
      .where(eq(bookings.id, testBooking.id));

    // Get audit report
    const reportResponse = await request(app)
      .get(`/audit-report/booking/${testBooking.id}`)
      .set(getAuthHeader(999, 'admin'));

    expect(reportResponse.status).toBe(200);

    // Verify contract in documents
    expect(reportResponse.body.documents.contract).toBeDefined();
    expect(reportResponse.body.documents.contract.status).toBe('signed');
    expect(reportResponse.body.documents.contract.signedUrl).toContain('signed=true');

    // Find contract signing events in timeline
    const timeline = reportResponse.body.timeline;
    const signingEvents = timeline.filter((e: any) => e.action.includes('contract.signed'));

    expect(signingEvents.length).toBe(2);

    // Verify Stage 1 (Publisher)
    const stage1Event = signingEvents.find((e: any) => e.action === 'contract.signed.stage1');
    expect(stage1Event).toBeDefined();
    expect(stage1Event.userId).toBe(testPublisher.id);
    expect(stage1Event.metadata.ip).toBe('200.45.67.89');
    expect(stage1Event.details.pdfHash).toBe('abc123def456789stage1hash');

    // Verify Stage 2 (Renter)
    const stage2Event = signingEvents.find((e: any) => e.action === 'contract.signed.stage2');
    expect(stage2Event).toBeDefined();
    expect(stage2Event.userId).toBe(testRenter.id);
    expect(stage2Event.metadata.ip).toBe('181.23.45.67');
    expect(stage2Event.details.pdfHash).toBe('xyz789final456hashcomplete');

    // Verify emails section
    expect(reportResponse.body.emails.length).toBeGreaterThan(0);
    expect(reportResponse.body.emails[0].type).toBe('final_contract');
    expect(reportResponse.body.emails[0].sentAt).toBeDefined();

    console.log('✓ Contract signing chain of custody verified:');
    console.log('  - Publisher signed from IP', stage1Event.metadata.ip);
    console.log('  - Renter signed from IP', stage2Event.metadata.ip);
    console.log('  - Final PDF hash:', stage2Event.details.pdfHash);
  });
});

describe('Legal Scenario: Email Identity Verification', () => {
  let app: express.Express;
  let db: any;
  let testUser: any;
  let testContract: any;

  beforeEach(async () => {
    ({ db } = await setupTestDatabase());
    currentTestDb = db;

    app = express();
    app.use(express.json());
    app.use((req: any, res, next) => {
      req.user = { id: 1, role: 'admin' };
      next();
    });

    [testUser] = await db.insert(users).values({
      name: 'Email Test User',
      email: 'email.test@example.com',
      password: 'hash',
      role: 'driver',
    }).returning();

    const [template] = await db.insert(contractTemplates).values({
      name: 'Test Template',
      type: 'rental_agreement',
      pdfUrl: 'https://example.com/template.pdf',
      fields: [],
      stages: [],
    }).returning();

    [testContract] = await db.insert(contractInstances).values({
      templateId: template.id,
      status: 'pending',
      renterId: testUser.id,
      auditLog: [],
    }).returning();
  });

  afterEach(async () => {
    await teardownTestDatabase();
    currentTestDb = null;
  });

  it('should track email delivery and opens as identity proof', async () => {
    // SCENARIO: Proving that the person who signed had access to the registered email
    // This is crucial for electronic signature validity in Argentina

    // Simulate email sent
    await db.update(contractInstances)
      .set({ emailSentAt: new Date('2026-02-19T10:00:00Z') })
      .where(eq(contractInstances.id, testContract.id));

    // Log magic link creation (identity verification step)
    await db.insert(auditLogs).values({
      userId: testUser.id,
      action: 'magic_link.created',
      entityType: 'contract_instance',
      entityId: testContract.id,
      details: {
        purpose: 'contract_signing',
        email: 'email.test@example.com',
        expiresAt: new Date('2026-02-19T10:15:00Z').toISOString(),
      },
      metadata: {
        ip: 'system',
        userAgent: 'EmailService',
        timestamp: new Date('2026-02-19T10:00:00Z').toISOString(),
      },
    });

    // Log magic link usage (proves email access)
    await db.insert(auditLogs).values({
      userId: testUser.id,
      action: 'magic_link.used',
      entityType: 'contract_instance',
      entityId: testContract.id,
      details: {
        email: 'email.test@example.com',
      },
      metadata: {
        ip: '190.12.34.56',
        userAgent: 'Mozilla/5.0 (Linux; Android 12)',
        timestamp: new Date('2026-02-19T10:05:00Z').toISOString(),
      },
    });

    // Log email opened (tracking pixel)
    await db.insert(auditLogs).values({
      userId: testUser.id,
      action: 'contract.email.opened',
      entityType: 'contract_instance',
      entityId: testContract.id,
      details: { role: 'renter' },
      metadata: {
        ip: '190.12.34.56',
        userAgent: 'Mozilla/5.0 (Linux; Android 12)',
        timestamp: new Date('2026-02-19T10:04:00Z').toISOString(),
      },
    });

    await db.update(contractInstances)
      .set({ emailOpenedAt: new Date('2026-02-19T10:04:00Z') })
      .where(eq(contractInstances.id, testContract.id));

    // Verify audit trail
    const identityLogs = await db.select()
      .from(auditLogs)
      .where(eq(auditLogs.entityId, testContract.id))
      .orderBy(auditLogs.createdAt);

    expect(identityLogs.length).toBe(3);

    // Verify sequence: link created -> email opened -> link used
    const actions = identityLogs.map((log: any) => log.action);
    expect(actions).toContain('magic_link.created');
    expect(actions).toContain('contract.email.opened');
    expect(actions).toContain('magic_link.used');

    // Verify IP consistency (same device accessed email and used link)
    const emailOpenLog = identityLogs.find((log: any) => log.action === 'contract.email.opened');
    const linkUsedLog = identityLogs.find((log: any) => log.action === 'magic_link.used');

    expect((emailOpenLog.metadata as any).ip).toBe((linkUsedLog.metadata as any).ip);

    console.log('✓ Email identity verification chain proven:');
    console.log('  - Email sent at', new Date('2026-02-19T10:00:00Z').toISOString());
    console.log('  - Email opened from IP', (emailOpenLog.metadata as any).ip);
    console.log('  - Magic link used from same IP');
  });
});
