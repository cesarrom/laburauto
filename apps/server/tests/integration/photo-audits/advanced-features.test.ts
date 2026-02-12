import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
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
  submitPhotoAudit,
  getEvidenceKit,
  createContractTemplate,
  loginUser,
  reviewVehicle,
  activateSubscription,
  verifyUser
} from '../../helpers/api-utils';


describe('Advanced Features: Contracts, Audits & Admin', () => {
  let app: any;
  let db: any;
  let sqlConnection: any;

  let admin: any;
  let publisher: any;
  let renter: any;
  let vehicle: any;
  let booking: any;

  beforeAll(async () => {
    const setup = await setupTestDatabase();
    db = setup.db;
    sqlConnection = setup.sql;
    app = (await import('../../../src/app')).default;
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  async function setupGlobalState() {
    const password = 'password';

    // Users
    const adminRes = await ensureUser(app, { name: 'Admin', email: 'admin@laburauto.com', password });
    await makeAdmin(db, adminRes.user.id);
    // Refresh token to get 'admin' role
    admin = await loginUser(app, { email: adminRes.user.email, password });

    const pubRes = await ensureUser(app, { name: 'Pub', email: `pub-${Date.now()}@test.com`, password });
    await onboardUser(app, pubRes.token, { userId: pubRes.user.id, role: 'publisher' });
    publisher = await loginUser(app, { email: pubRes.user.email, password });
    await activateSubscription(db, publisher.user.id);

    const rentRes = await ensureUser(app, { name: 'Renter', email: `renter-adv-${Date.now()}@test.com`, password });
    await onboardUser(app, rentRes.token, { userId: rentRes.user.id, role: 'driver' });
    renter = await loginUser(app, { email: rentRes.user.email, password });
    await verifyUser(db, renter.user.id);


    // Vehicle
    const [model] = await db.insert(schema.vehicleModels).values({
      typeId: 1, typeName: 'Car', brandId: 1, brandName: 'Toyota', modelId: 1, modelName: 'Corolla', versionId: 1, versionName: 'XEI'
    }).returning();

    const vRes = await publishVehicle(app, publisher.token, {
      vehicleModelId: model.id,
      year: 2022,
      plate: 'ADV' + Math.floor(Math.random() * 900 + 100),
      mileage: 10000,
      color: 'Black',
      description: 'Vehículo avanzado para pruebas de auditoría de fotos.',
      photos: ['url.jpg'],
      registrationCertificate: 'cert.pdf',
      proofOfInsurance: 'ins.pdf',
      technicalInspection: 'vtv.pdf',
      paymentInstructions: 'Transferencia bancaria al CBU 0001112223334445556667',
      shifts: [{ type: 'morning', price: 1000, startTime: '08:00', endTime: '16:00' }],
      location: {
        address: 'Calle Falsa 123',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        country: 'USA',
        latitude: 39.7983,
        longitude: -89.6501
      }
    });
    if (vRes.status !== 201) console.error('DEBUG: publishVehicle failed:', JSON.stringify(vRes.body, null, 2));
    expect(vRes.status).toBe(201);
    vehicle = vRes.body;

    // Admin approves vehicle
    await makeAdmin(db, admin.user.id);
    const reviewVRes = await reviewVehicle(app, admin.token, vehicle.id, 'approve');
    if (reviewVRes.status !== 200) console.error('DEBUG: reviewVehicle failed:', reviewVRes.body);
    expect(reviewVRes.status).toBe(200);

    // Template
    const tRes = await createContractTemplate(app, admin.token, {
      name: 'Rental Agreement v1',
      type: 'rental_agreement',
      pdfUrl: 'mock-pdf-url',
      fields: [],
      stages: [{ id: 's1', name: 'Renter Signing', label: 'Renter', role: 'renter', type: 'signer', order: 1 }]
    });
    expect(tRes.status).toBe(201);

    // Booking
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const applyRes = await applyForVehicle(app, renter.token, {
      vehicleId: vehicle.id,
      selectedDates: [tomorrow],
      selectedShiftIds: [vehicle.shifts[0].id]
    });
    if (applyRes.status !== 201) {
      console.error('DEBUG: applyForVehicle failed:', JSON.stringify(applyRes.body, null, 2));
      console.error('DEBUG: vehicle shifts:', JSON.stringify(vehicle.shifts, null, 2));
    }
    expect(applyRes.status).toBe(201);

    const reviewRes = await reviewApplication(app, publisher.token, applyRes.body.id, 'approve');
    if (reviewRes.status !== 200) console.error('DEBUG: reviewApplication failed:', reviewRes.body);
    expect(reviewRes.status).toBe(200);



    booking = await db.query.bookings.findFirst({ where: eq(schema.bookings.vehicleId, vehicle.id) });

  }

  describe('Contract System & Photo Audits', () => {
    let contractId: number;

    beforeAll(async () => {
      await setupGlobalState();
    });

    it('should have a contract instance linked to the booking', async () => {
      expect(booking.contractId).toBeDefined();
      contractId = booking.contractId;
    });


    it('should submit a signature result via API', async () => {
      // In these tests, we use the simple 'sign' endpoint which is more generic
      // (Used by SDK and certain flows)
      contractId = booking.contractId;

      const res = await request(app)
        .post(`/api/contracts/instances/${contractId}/sign`)
        .set('Authorization', `Bearer ${renter.token}`)

        .send({
          finalPdfUrl: 'https://cdn.test.com/signed/rent_signed.pdf',
          auditEvent: {
            userId: renter.user.id,
            user: renter.user.email, // Legacy field if needed, but schema wants userId
            action: 'signed',
            timestamp: new Date().toISOString(),
            isFinal: true
          }
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('signed');
    });

    it('should reject audit with non-live metadata', async () => {
      const res = await submitPhotoAudit(app, renter.token, {
        bookingId: booking.id,
        type: 'check_in',
        photos: ['url1'],
        odometerReading: 10500,
        metadata: { isLive: false }
      });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('live');
    });

    it('should successfully submit check-in audit and update vehicle lastOdometer', async () => {
      const res = await submitPhotoAudit(app, renter.token, {
        bookingId: booking.id,
        type: 'check_in',
        photos: ['url1', 'url2'],
        odometerReading: 10500,
        metadata: { isLive: true, gps: { lat: -34.6, lng: -58.4 } }
      });

      expect(res.status).toBe(201);

      const updatedVehicle = await db.query.vehicles.findFirst({
        where: eq(schema.vehicles.id, vehicle.id)
      });
      expect(updatedVehicle.lastOdometer).toBe(10500);
    });

    it('should complete booking on check-out audit', async () => {
      // Must be 'active' status to checkout usually, but let's see if the route allows it
      // actually status is 'confirmed' currently. Rental starts implicitly or explicitly?
      // In contracts.test.ts we signed. Let's force start rental if needed.
      await db.update(schema.bookings).set({ status: 'active', contractFullySigned: true }).where(eq(schema.bookings.id, booking.id));

      await submitPhotoAudit(app, renter.token, {
        bookingId: booking.id,
        type: 'check_out',
        photos: ['url3'],
        odometerReading: 10600,
        metadata: { isLive: true }
      });

      const updatedBooking = await db.query.bookings.findFirst({
        where: eq(schema.bookings.id, booking.id)
      });
      expect(updatedBooking.status).toBe('completed');
    });

    it('should generate a consolidated evidence kit for an admin', async () => {
      const res = await getEvidenceKit(app, admin.token, booking.id);

      expect(res.status).toBe(200);
      expect(res.body.legalIdentity.renterName).toBe('Renter');
      expect(res.body.contract.status).toBe('signed');
      expect(res.body.auditHistory).toHaveLength(2); // check_in and check_out
    });
  });
});
