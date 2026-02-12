import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import * as schema from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';
import {
  ensureUser,
  onboardUser,
  makeAdmin,
  publishVehicle,
  applyForVehicle,
  reviewApplication,
  uploadPaymentProof,
  confirmReceipt,
  createContractTemplate,
  signContract,
  loginUser
} from '../../helpers/api-utils';

describe('Systems Integration: Contract Templates & Signing', () => {
  let app: any;
  let db: any;
  let sqlConnection: any;
  let admin: any;

  beforeAll(async () => {
    const result = await setupTestDatabase();
    db = result.db;
    sqlConnection = result.sql;
    app = (await import('../../../src/app')).default;

    // Setup Admin for template creation
    const adminRes = await ensureUser(app, { name: 'Admin', email: 'admin-contract@test.com', password: 'password123' });
    await makeAdmin(db, adminRes.user.id);
    admin = await loginUser(app, { email: 'admin-contract@test.com', password: 'password123' });

  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  async function setupUsers() {
    const password = 'password123';

    // Publisher
    const pubRes = await ensureUser(app, { name: 'John Publisher', email: `pub-con-${Date.now()}@test.com`, password });
    await onboardUser(app, pubRes.token, { userId: pubRes.user.id, role: 'publisher' });
    // Refresh token after onboarding to get the 'publisher' role in JWT
    const publisher = await loginUser(app, { email: pubRes.user.email, password });

    await db.update(schema.users).set({ subscriptionStatus: 'active' }).where(eq(schema.users.id, publisher.user.id));

    // Renter
    const rentRes = await ensureUser(app, { name: 'Alice Renter', email: `renter-con-${Date.now()}@test.com`, password });
    await onboardUser(app, rentRes.token, {
      userId: rentRes.user.id,
      role: 'driver',
      documents: { uberRating: '5.0', dniPhoto: 'url', criminalBackground: 'url' }
    });
    // Refresh token after onboarding to get the 'driver' role in JWT
    const renter = await loginUser(app, { email: rentRes.user.email, password });

    return { publisher, renter };
  }

  it('should create a template and use it for a rental agreement', async () => {
    // 1. Setup Users & Vehicle
    const { publisher, renter } = await setupUsers();

    const [model] = await db.insert(schema.vehicleModels).values({
      brandName: 'Ford', modelName: 'Focus', typeName: 'Auto', typeId: 1, brandId: 1, modelId: 1, versionName: 'Trend', versionId: 1,
    }).returning();

    const vehicleRes = await publishVehicle(app, publisher.token, {
      vehicleModelId: model.id,
      year: 2021,
      plate: 'CON' + Math.floor(Math.random() * 900 + 100),
      mileage: 50000,
      color: 'Gray',
      description: 'Test car for contract integration',
      photos: ['photo.jpg'],
      registrationCertificate: 'cert.pdf',
      proofOfInsurance: 'ins.pdf',
      technicalInspection: 'vtv.pdf',
      paymentInstructions: 'Transferencia bancaria CBU 1234567890123456789012',
      shifts: [{ type: 'morning', price: 15000, startTime: '06:00', endTime: '18:00' }]
    });

    const vehicle = vehicleRes.body;



    // 2. Create Contract Template (Admin)
    const templateRes = await createContractTemplate(app, admin.token, {
      name: 'Standard Rental Agreement',
      type: 'rental_agreement',
      pdfUrl: 'mock-pdf-url',

      fields: [
        { id: 'f1', type: 'variable', value: '{{publisher.name}}', label: 'Publisher Name', page: 1, x: 100, y: 100, width: 200, height: 20 },
        { id: 'f2', type: 'variable', value: '{{renter.name}}', label: 'Renter Name', page: 1, x: 100, y: 150, width: 200, height: 20 },
        { id: 'f3', type: 'signature', label: 'Publisher Signature', page: 2, x: 100, y: 200, width: 200, height: 50 },
      ],
      stages: [
        { id: 'st_signer_1', name: 'Publisher Signing', order: 1, role: 'publisher' },
        { id: 'st_signer_2', name: 'Renter Signing', order: 2, role: 'renter' },
      ],
      variableSchema: {
        'publisher': { 'name': { type: 'string', label: 'Name', path: 'publisher.name' } },
        'renter': { 'name': { type: 'string', label: 'Name', path: 'renter.name' } }
      }
    });
    expect(templateRes.status).toBe(201);
    const template = templateRes.body;

    // 3. Application -> Approve (Trigger instance creation)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const applyRes = await applyForVehicle(app, renter.token, {
      vehicleId: vehicle.id,
      selectedDates: [tomorrow],

      selectedShiftIds: [vehicle.shifts[0].id],
    });
    const approveRes = await reviewApplication(app, publisher.token, applyRes.body.id, 'approve');
    expect(approveRes.status).toBe(200);

    const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.vehicleId, vehicle.id) });
    const contractId = booking.contractId;
    expect(contractId).toBeDefined();

    // 4. Pay -> Confirm Receipt
    await uploadPaymentProof(app, renter.token, booking.id, 'https://example.com/proof.jpg');
    const confirmRes = await confirmReceipt(app, publisher.token, booking.id);
    expect(confirmRes.status).toBe(200);

    // 4. Multi-Stage Signing via API

    // Stage 1: Publisher signs
    const sign1Res = await signContract(app, publisher.token, contractId, {
      signedPdfUrl: 'https://storage.example.com/signed/stage1.pdf',
      fields: [{ id: 'f3', type: 'signature', value: 'data:image/png;base64,...' }]
    });
    expect(sign1Res.status).toBe(200);
    expect(sign1Res.body.instance.stage1CompletedAt).toBeDefined();

    // Stage 2: Renter signs and finalizes
    const sign2Res = await signContract(app, renter.token, contractId, {
      signedPdfUrl: 'https://storage.example.com/signed/final.pdf',
      fields: [{ id: 'f4', type: 'signature', value: 'data:image/png;base64,...' }]
    });
    expect(sign2Res.status).toBe(200);
    expect(sign2Res.body.instance.status).toBe('signed');
    expect(sign2Res.body.instance.signedAt).toBeDefined();

    // 5. Verify Booking Update
    const finalBooking = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, booking.id) });
    expect(finalBooking.contractFullySigned).toBe(true);
    expect(finalBooking.contractId).toBe(contractId);

    console.log('✓ Contract full lifecycle completed via API');
  });
});
