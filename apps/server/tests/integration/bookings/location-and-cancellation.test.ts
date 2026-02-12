import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import * as schema from '@laburauto/shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  ensureUser, loginUser, makeAdmin, onboardUser, createContractTemplate,
  publishVehicle, applyForVehicle, reviewApplication, createBooking, reviewVehicle, activateSubscription, verifyUser,
  signContract, confirmReceipt, cancelByPublisher, getVehicleLocation, uploadPaymentProof
} from '../../helpers/api-utils';



describe('Integration: Location Sharing & Cancellation', () => {
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

    // Admin for template creation
    const adminRes = await ensureUser(app, { name: 'Admin', email: `admin-${Date.now()}@test.com`, password });
    await makeAdmin(db, adminRes.user.id);
    const admin = await loginUser(app, { email: adminRes.user.email, password });

    const pubRes = await ensureUser(app, { name: 'Pub', email: `pub-${Date.now()}@test.com`, password });
    await onboardUser(app, pubRes.token, { userId: pubRes.user.id, role: 'publisher' });
    const publisher = await loginUser(app, { email: pubRes.user.email, password });

    await activateSubscription(db, publisher.user.id);


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
      plate: 'LOC' + Math.floor(Math.random() * 900 + 100),
      mileage: 10000,
      color: 'Silver',
      description: 'Esta es una descripción de prueba para cumplir con la validación de 20 caracteres.',
      photos: ['photo1.jpg'],
      registrationCertificate: 'cert.pdf',
      proofOfInsurance: 'ins.pdf',
      technicalInspection: 'vtv.pdf',
      paymentInstructions: 'Usa esta cuenta bancaria para pagar el alquiler.',

      idleLat: -34.6037,
      idleLong: -58.3816,
      idleAddress: 'Av. Corrientes 1000',
      accessInstructions: 'Ring doorbell',
      shifts: [{ type: 'morning', price: 5000, startTime: '06:00', endTime: '14:00' }]
    });
    expect(res.status).toBe(201);

    // Admin approves vehicle
    const { admin } = await setupUsers(); // Re-use setupUsers logic or make a temp admin
    await makeAdmin(db, admin.user.id);
    const reviewVRes = await reviewVehicle(app, admin.token, res.body.id, 'approve');
    expect(reviewVRes.status).toBe(200);

    return res.body;

  }

  describe('Location Sharing', () => {
    it('should allow location access when booking is confirmed and within 2h', async () => {
      const { publisher, renter } = await setupUsers();
      const vehicle = await setupVehicle(publisher.token);

      // Create confirmed booking
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const appRes = await applyForVehicle(app, renter.token, {
        vehicleId: vehicle.id,
        selectedDates: [tomorrow],
        selectedShiftIds: [vehicle.shifts[0].id],
      });

      await reviewApplication(app, publisher.token, appRes.body.id, 'approve');

      const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.applicationId, appRes.body.id) });
      const contractId = booking.contractId;
      await signContract(app, publisher.token, contractId, { signedPdfUrl: 'url' });
      await signContract(app, renter.token, contractId, { signedPdfUrl: 'url' });
      await uploadPaymentProof(app, renter.token, booking.id, 'https://example.com/proof.jpg');

      await confirmReceipt(app, publisher.token, booking.id);

      // Adjust date to satisfy 2h window
      const pickupTime = new Date();
      pickupTime.setHours(pickupTime.getHours() + 1); // 1 hour from now
      await db.update(schema.bookings).set({ startDate: pickupTime.toISOString() }).where(eq(schema.bookings.id, booking.id));

      const locRes = await getVehicleLocation(app, renter.token, booking.id);

      expect(locRes.status).toBe(200);
      expect(locRes.body.location.lat).toBe(-34.6037);
      expect(locRes.body.accessInstructions).toBe('Ring doorbell');

      const updated = await db.query.bookings.findFirst({ where: eq(schema.bookings.id, booking.id) });
      expect(updated.renterCanSeeLocation).toBe(true);
      expect(updated.locationSharedAt).toBeDefined();
    });

    it('should NOT share location for pending_payment status', async () => {
      const { publisher, renter } = await setupUsers();
      const vehicle = await setupVehicle(publisher.token);

      const appRes = await applyForVehicle(app, renter.token, {
        vehicleId: vehicle.id,
        selectedDates: [new Date(Date.now() + 86400000).toISOString().split('T')[0]],
        selectedShiftIds: [vehicle.shifts[0].id],
      });
      await reviewApplication(app, publisher.token, appRes.body.id, 'approve');
      const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.applicationId, appRes.body.id) });

      // Even if within 2h
      const pickupTime = new Date();
      pickupTime.setHours(pickupTime.getHours() + 1);
      await db.update(schema.bookings).set({ startDate: pickupTime.toISOString() }).where(eq(schema.bookings.id, booking.id));

      const locRes = await getVehicleLocation(app, renter.token, booking.id);
      expect(locRes.status).toBe(403);
      expect(locRes.body.error).toContain('Location not yet available');
    });
  });

  describe('Cancellation', () => {
    it('should allow publisher to cancel confirmed booking with refund', async () => {
      const { publisher, renter } = await setupUsers();
      const vehicle = await setupVehicle(publisher.token);

      const appRes = await applyForVehicle(app, renter.token, {
        vehicleId: vehicle.id,
        selectedDates: [new Date(Date.now() + 86400000).toISOString().split('T')[0]],
        selectedShiftIds: [vehicle.shifts[0].id],
      });
      await reviewApplication(app, publisher.token, appRes.body.id, 'approve');
      const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.applicationId, appRes.body.id) });
      const contract = await db.query.contractInstances.findFirst({ where: eq(schema.contractInstances.bookingId, booking.id) });
      const contractId = contract.id;
      await signContract(app, publisher.token, contractId, { signedPdfUrl: 'url' });
      await signContract(app, renter.token, contractId, { signedPdfUrl: 'url' });
      await uploadPaymentProof(app, renter.token, booking.id, 'https://example.com/proof.jpg');

      await confirmReceipt(app, publisher.token, booking.id);

      const cancelRes = await cancelByPublisher(app, publisher.token, booking.id, 'Vehicle needs urgent maintenance');

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('cancelled');
      expect(cancelRes.body.cancelledBy).toBe('publisher');
      expect(cancelRes.body.refundStatus).toBe('pending');
    });

    it('should NOT allow cancellation of active rental', async () => {
      const { publisher, renter } = await setupUsers();
      const vehicle = await setupVehicle(publisher.token);

      const appRes = await applyForVehicle(app, renter.token, {
        vehicleId: vehicle.id,
        selectedDates: [new Date(Date.now() + 86400000).toISOString().split('T')[0]],
        selectedShiftIds: [vehicle.shifts[0].id],
      });
      await reviewApplication(app, publisher.token, appRes.body.id, 'approve');
      const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.applicationId, appRes.body.id) });
      const contractId = booking.contractId;
      await signContract(app, publisher.token, contractId, { signedPdfUrl: 'url' });
      await signContract(app, renter.token, contractId, { signedPdfUrl: 'url' });
      await uploadPaymentProof(app, renter.token, booking.id, 'https://example.com/proof.jpg');

      await confirmReceipt(app, publisher.token, booking.id);

      // Start rental
      await db.update(schema.bookings).set({ startDate: new Date().toISOString() }).where(eq(schema.bookings.id, booking.id));
      await request(app).post(`/api/bookings/${booking.id}/arrive`).set('Authorization', `Bearer ${renter.token}`).send({});
      await request(app).post(`/api/bookings/${booking.id}/start-rental`).set('Authorization', `Bearer ${renter.token}`).send({});

      const cancelRes = await cancelByPublisher(app, publisher.token, booking.id, 'Too late');
      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.error).toContain('Cannot cancel active rental');
    });

    it('should allow cancellation before payment without refund', async () => {
      const { publisher, renter } = await setupUsers();
      const vehicle = await setupVehicle(publisher.token);

      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      const appRes = await applyForVehicle(app, renter.token, {
        vehicleId: vehicle.id,
        selectedDates: [tomorrow],
        selectedShiftIds: [vehicle.shifts[0].id],
      });

      const reviewRes = await reviewApplication(app, publisher.token, appRes.body.id, 'approve');
      expect(reviewRes.status).toBe(200);
      const booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.applicationId, appRes.body.id) });


      const cancelRes = await cancelByPublisher(app, publisher.token, booking.id, 'Changed mind');

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('cancelled');
      expect(cancelRes.body.refundStatus).toBe('none');
    });
  });
});
