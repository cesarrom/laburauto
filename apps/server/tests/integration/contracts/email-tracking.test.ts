import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import { users, vehicles, vehicleModels, bookings, contractTemplates, contractInstances } from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';
import express from 'express';
import { mockSentEmails } from '../../../src/services/emailService';
import { getAuthHeader } from '../../helpers/auth';

// Mock the database module to point to our test database instance
let currentTestDb: any;
vi.mock('../../../src/db', () => ({
  db: new Proxy({}, {
    get: (_target, prop) => {
      if (!currentTestDb) throw new Error('Test DB not initialized');
      return currentTestDb[prop];
    }
  })
}));

// Mock PdfService and bytescale
vi.mock('../../../src/services/pdfService', () => ({
  PdfService: {
    compilePdf: vi.fn().mockResolvedValue(Buffer.from('mock-pdf-buffer')),
  }
}));

vi.mock('../../../src/services/bytescale', () => ({
  uploadBuffer: vi.fn().mockResolvedValue('https://storage.example.com/compiled_contract.pdf'),
  // Add other exports if contracts.ts uses them, though it seems it only uses uploadBuffer from what we saw
  uploadFile: vi.fn(),
}));

import { PdfService } from '../../../src/services/pdfService';
import { uploadBuffer } from '../../../src/services/bytescale';

// Import router AFTER mocking
import contractsRouter from '../../../src/routes/contracts';

describe('Email Delivery and Tracking', () => {
  let app: express.Express;
  let db: any;
  let sql: any;

  beforeEach(async () => {
    ({ db, sql } = await setupTestDatabase());
    currentTestDb = db; // Update the reference for the mock

    app = express();
    app.use(express.json());

    app.use(contractsRouter);

    // Clear mock emails
    mockSentEmails.length = 0;
  });

  afterEach(async () => {
    await teardownTestDatabase();
    currentTestDb = null;
  });

  it('should trigger email and track opening', async () => {
    // 1. Setup Data
    const [publisher] = await db.insert(users).values({
      name: 'John Publisher',
      email: 'john@example.com',
      password: 'password123',
      role: 'publisher',
    }).returning();

    const [renter] = await db.insert(users).values({
      name: 'Alice Renter',
      email: 'alice@example.com',
      password: 'password123',
      role: 'driver',
    }).returning();

    const [model] = await db.insert(vehicleModels).values({
      brandName: 'Ford', modelName: 'Focus', typeName: 'Auto',
      typeId: 1, brandId: 1, modelId: 1, versionName: 'Trend', versionId: 1,
    }).returning();

    const [vehicle] = await db.insert(vehicles).values({
      publisherId: publisher.id,
      vehicleModelId: model.id,
      plate: 'JJJ999',
      year: 2021, mileage: 50000, color: 'Gris',
      description: 'Test vehicle',
      status: 'active',
    }).returning();

    const [booking] = await db.insert(bookings).values({
      vehicleId: vehicle.id,
      driverId: renter.id,
      startDate: '2026-02-01', endDate: '2026-02-02',
      selectedShiftIds: [1, 1], totalPrice: 15000, status: 'confirmed',
    }).returning();

    const [template] = await db.insert(contractTemplates).values({
      name: 'Standard', type: 'rental_agreement', pdfUrl: 'http://example.com/template.pdf',
      fields: [], stages: [{ id: 'st1', order: 1, role: 'renter' }], variableSchema: {},
    }).returning();

    const [instance] = await db.insert(contractInstances).values({
      templateId: template.id,
      status: 'pending',
      variableValues: {},
      publisherId: publisher.id,
      renterId: renter.id,
      bookingId: booking.id,
      stage1CompletedAt: new Date(),
      stage1CompletedBy: publisher.id,
    }).returning();

    // Link booking to contract
    await db.update(bookings)
      .set({ contractId: instance.id })
      .where(eq(bookings.id, booking.id));

    // 2. Mock full signature to trigger email
    // We'll call the sign endpoint for the last stage
    // Note: Router is mounted at root in this test app
    const res = await request(app)
      .post(`/instances/${instance.id}/sign-stage-2`)
      .set(getAuthHeader(renter.id, 'driver'))
      .send({
        signedPdfUrl: 'http://example.com/signed.pdf',
        fields: [{ type: 'signature', page: 1, x: 10, y: 10, width: 100, height: 50, signatureData: 'data:image/png;base64,...' }]
      });

    if (res.status !== 200) {
      console.error('Sign error:', res.body);
    }
    expect(res.status).toBe(200);

    // 3. Verify Email was sent (mocked)
    expect(mockSentEmails.length).toBe(1);
    expect(mockSentEmails[0].to).toContain('john@example.com');
    expect(mockSentEmails[0].to).toContain('alice@example.com');
    expect(mockSentEmails[0].html).toContain(`/api/contracts/instances/${instance.id}/track`);

    // 4. Track opening (endpoint requires role and email)
    const trackRes = await request(app)
      .get(`/instances/${instance.id}/track/renter`)
      .query({ email: renter.email });

    expect(trackRes.status).toBe(200);
    expect(trackRes.header['content-type']).toBe('image/gif');

    // 5. Verify DB fields updated
    const [updatedInstance] = await db.select().from(contractInstances).where(eq(contractInstances.id, instance.id));
    expect(updatedInstance.emailSentAt).toBeDefined();
    expect(updatedInstance.emailSentAt).toBeDefined();
    expect(updatedInstance.emailOpenedAt).toBeDefined();

    // 6. Verify PDF Compilation
    expect(PdfService.compilePdf).toHaveBeenCalledWith(
      expect.stringContaining('http://example.com/template.pdf'), // or instance.finalPdfUrl
      expect.arrayContaining([expect.objectContaining({ type: 'signature' })])
    );
    expect(uploadBuffer).toHaveBeenCalled();
    expect(updatedInstance.finalPdfUrl).toBe('https://storage.example.com/compiled_contract.pdf');
  });
});
