import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import * as schema from '@laburauto/shared/schema';
import { eq, and, lt, sql } from 'drizzle-orm';
import {
  ensureUser,
  onboardUser,
  makeAdmin,
  publishVehicle,
  applyForVehicle,
  reviewApplication,
  createContractTemplate,
  uploadPaymentProof,
  confirmReceipt,
  disputePayment,
  expireOutdatedBookings,
  loginUser

} from '../../helpers/api-utils';


describe('Integration: Payment Fraud Prevention', () => {
  let app: any;
  let db: any;
  let sqlConnection: any;

  beforeAll(async () => {
    const result = await setupTestDatabase();
    db = result.db;
    sqlConnection = result.sql;
    app = (await import('../../../src/app')).default;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  async function setupUsers() {
    const password = 'password123';

    // Admin for template
    const adminRes = await ensureUser(app, { name: 'Admin', email: `admin-${Date.now()}@test.com`, password });
    await makeAdmin(db, adminRes.user.id);
    const admin = await loginUser(app, { email: adminRes.user.email, password });

    const pubRes = await ensureUser(app, { name: 'Pub', email: `pub-${Date.now()}@test.com`, password });
    await onboardUser(app, pubRes.token, { userId: pubRes.user.id, role: 'publisher' });
    const publisher = await loginUser(app, { email: pubRes.user.email, password });

    await db.update(schema.users).set({ subscriptionStatus: 'active' }).where(eq(schema.users.id, publisher.user.id));

    const rentRes = await ensureUser(app, { name: 'Renter', email: `renter-${Date.now()}@test.com`, password });
    await onboardUser(app, rentRes.token, {
      userId: rentRes.user.id,
      role: 'driver',
      documents: { uberRating: '5.0', dniPhoto: 'url', criminalBackground: 'url' }
    });
    const renter = await loginUser(app, { email: rentRes.user.email, password });

    // Create Template
    await createContractTemplate(app, admin.token, {
      name: 'Standard Rental Agreement',
      type: 'rental_agreement',
      pdfUrl: 'mock-pdf-url',
      fields: [],
      stages: [{ id: 's1', label: 'Pub', type: 'signer' }, { id: 's2', label: 'Rent', type: 'signer' }]
    });

    return { publisher, renter, admin };
  }


  async function setupVehicle(publisherToken: string) {
    const [model] = await db.insert(schema.vehicleModels).values({
      typeName: 'Auto', typeId: 1, brandName: 'Toyota', brandId: 1, modelName: 'Corolla', modelId: 1, versionName: 'XEI', versionId: 1,
    }).returning();

    const res = await publishVehicle(app, publisherToken, {
      vehicleModelId: model.id,
      year: 2022,
      plate: 'PAY' + Math.floor(Math.random() * 900 + 100),
      mileage: 10000,
      color: 'Silver',
      description: 'Vehículo en excelente estado para pruebas de pago.',
      photos: ['photo1.jpg'],
      registrationCertificate: 'cert.pdf',
      proofOfInsurance: 'ins.pdf',
      technicalInspection: 'vtv.pdf',
      paymentInstructions: 'Transferencia bancaria al CBU 0001112223334445556667',

      shifts: [{ type: 'morning', price: 5000, startTime: '06:00', endTime: '14:00' }]
    });
    return res.body;
  }

  it('should handle legitimate payment flow with proof', async () => {
    const { publisher, renter } = await setupUsers();
    const vehicle = await setupVehicle(publisher.token);

    // Apply and approve
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const appRes = await applyForVehicle(app, renter.token, {
      vehicleId: vehicle.id,
      selectedDates: [tomorrow],
      selectedShiftIds: [vehicle.shifts[0].id],
    });

    await reviewApplication(app, publisher.token, appRes.body.id, 'approve');
    const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.vehicleId, vehicle.id) });

    // Upload proof
    const proofRes = await uploadPaymentProof(app, renter.token, booking.id, 'https://example.com/proof.jpg');
    expect(proofRes.status).toBe(200);
    expect(proofRes.body.paymentProofUrl).toBe('https://example.com/proof.jpg');
    expect(proofRes.body.status).toBe('payment_sent');

    // Confirm receipt
    const confirmRes = await confirmReceipt(app, publisher.token, booking.id);
    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.status).toBe('confirmed');
    expect(confirmRes.body.paymentConfirmedAt).toBeDefined();

    console.log('✓ Legitimate payment flow completed via API');
  });

  it('should flag dispute when renter denies publisher denial', async () => {
    const { publisher, renter } = await setupUsers();
    const vehicle = await setupVehicle(publisher.token);

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const appRes = await applyForVehicle(app, renter.token, {
      vehicleId: vehicle.id,
      selectedDates: [tomorrow],
      selectedShiftIds: [vehicle.shifts[0].id],
    });

    await reviewApplication(app, publisher.token, appRes.body.id, 'approve');
    const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.vehicleId, vehicle.id) });

    await uploadPaymentProof(app, renter.token, booking.id, 'https://example.com/proof.jpg');

    const disputeRes = await disputePayment(app, renter.token, booking.id, 'I sent payment but publisher denies receiving it');
    expect(disputeRes.status).toBe(200);
    expect(disputeRes.body.disputeStatus).toBe('pending');
    expect(disputeRes.body.disputeNotes).toContain('publisher denies');

    console.log('✓ Dispute filed successfully via API');
  });

  it('should auto-expire bookings past payment deadline', async () => {
    const { publisher, renter } = await setupUsers();
    const vehicle = await setupVehicle(publisher.token);

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const appRes = await applyForVehicle(app, renter.token, {
      vehicleId: vehicle.id,
      selectedDates: [tomorrow],
      selectedShiftIds: [vehicle.shifts[0].id],
    });

    await reviewApplication(app, publisher.token, appRes.body.id, 'approve');
    const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.vehicleId, vehicle.id) });

    // Force deadline into past via SQL (backend logic for setting deadline is usually 24h, can't wait that long)
    const pastDeadline = new Date();
    pastDeadline.setMinutes(pastDeadline.getMinutes() - 5);
    await db.update(schema.bookings)
      .set({ paymentDeadline: pastDeadline })
      .where(eq(schema.bookings.id, booking.id));

    // Run expiration endpoint
    const expireRes = await expireOutdatedBookings(app);
    expect(expireRes.status).toBe(200);
    expect(expireRes.body.expiredCount).toBeGreaterThanOrEqual(1);

    const updated = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, booking.id) });
    expect(updated.status).toBe('expired');
    expect(updated.cancelledBy).toBe('system');

    console.log('✓ Booking auto-expired via API endpoint');
  });

  it('should not expire bookings with future deadline', async () => {
    const { publisher, renter } = await setupUsers();
    const vehicle = await setupVehicle(publisher.token);

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const appRes = await applyForVehicle(app, renter.token, {
      vehicleId: vehicle.id,
      selectedDates: [tomorrow],
      selectedShiftIds: [vehicle.shifts[0].id],
    });

    await reviewApplication(app, publisher.token, appRes.body.id, 'approve');
    const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.vehicleId, vehicle.id) });

    // Set future deadline
    const futureDeadline = new Date();
    futureDeadline.setHours(futureDeadline.getHours() + 1);
    await db.update(schema.bookings)
      .set({ paymentDeadline: futureDeadline })
      .where(eq(schema.bookings.id, booking.id));

    await expireOutdatedBookings(app);

    const stillPending = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, booking.id) });
    expect(stillPending.status).toBe('pending_payment');

    console.log('✓ Booking with future deadline NOT expired');
  });
});
