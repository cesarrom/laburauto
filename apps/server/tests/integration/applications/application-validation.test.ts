
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

// Database Proxy setup to share connection between Test and App
const dbContainer = { current: null as any };

vi.mock('../../../src/db', () => ({
  db: new Proxy({}, {
    get: (_target, prop) => {
      if (!dbContainer.current) throw new Error('Test DB not initialized');
      return dbContainer.current[prop];
    }
  })
}));

import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import {
  ensureUser,
  publishVehicle,
  verifyUser,
  onboardUser,
  reviewVehicle,
  makeAdmin,
  activateSubscription,
} from '../../helpers/api-utils';
import authRouter from '../../../src/routes/auth';
import vehiclesRouter from '../../../src/routes/vehicles';
import applicationsRouter from '../../../src/routes/applications';
import bookingsRouter from '../../../src/routes/bookings'; // bookings often link here
import { vehicles, vehicleModels } from '@laburauto/shared/schema';

// We need to mount the app with the routes, or use the actual app if possible.
// Often integration tests import the real app or cleaner to just mount what we need.
// However, the helpers use `request(app)`.
// Let's assume we can construct a test app or import the real one.
// The original file imported `import app from '../app';`.
// We should stick to that if it works, or build a fresh express app for isolation if `app.ts` has side effects.
// Given previous tests use `app` from `../app` or build one.
// Let's look at `audit-api.test.ts`. It imports `authRouter` etc and builds an app.
// I will build an app to be safe and consistent with other integration tests I've seen in the conversation history (e.g. `audit-api.test.ts`).

import { validateRequest } from '../../../src/middleware/validate'; // If needed, but routes usually have it.

describe('Rental Application Integration', () => {
  let db: any;
  let app: express.Express;

  beforeEach(async () => {
    const setup = await setupTestDatabase();
    db = setup.db;
    dbContainer.current = db; // Inject DB into the proxy

    // Setup generic app
    app = express();
    app.use(express.json());
    // Mock user attachment middleware if needed, but our helpers use /api/auth/login.
    // Wait, `ensureUser` uses `request(app).post('/api/auth/login')`.
    // So `app` needs to have the auth routes mounted.

    // Mount all necessary routes
    app.use('/api/auth', authRouter);
    app.use('/api/vehicles', vehiclesRouter);
    app.use('/api/applications', applicationsRouter);
    app.use('/api/bookings', bookingsRouter);

    // We might need to mock internal services that sending emails or S3
    // The previous test mocked bytescale.
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  // Helpers to setup constraints
  const setupModels = async () => {
    const [model] = await db.insert(vehicleModels).values({
      typeId: 1,
      typeName: 'Car',
      brandId: 100,
      brandName: 'Toyota',
      modelId: 200,
      modelName: 'Corolla',
      versionId: 300,
      versionName: 'XLI',
      yearStart: 2020,
      yearEnd: 2025
    }).returning();
    return model;
  };

  it('should create application when inputs are valid', async () => {
    const model = await setupModels();

    // 1. Setup Users
    const publisher = await ensureUser(app, { email: 'pub@test.com', password: 'password123', name: 'Publisher' });
    const renter = await ensureUser(app, { email: 'renter@test.com', password: 'password123', name: 'Renter' });

    // Onboard Publisher
    await onboardUser(app, publisher.token, { userId: publisher.user.id, role: 'publisher' });
    await activateSubscription(db, publisher.user.id);
    // Refresh token to get role
    const pubLogin = await request(app).post('/api/auth/login').send({ email: 'pub@test.com', password: 'password123' });
    publisher.token = pubLogin.body.token;

    // Onboard and Verify Renter
    await onboardUser(app, renter.token, { userId: renter.user.id, role: 'driver' });
    await verifyUser(db, renter.user.id);
    // Refresh token
    const renterLogin = await request(app).post('/api/auth/login').send({ email: 'renter@test.com', password: 'password123' });
    renter.token = renterLogin.body.token;

    // 2. Publisher creates Vehicle with Shifts
    const vehicleRes = await publishVehicle(app, publisher.token, {
      vehicleModelId: model.id,
      year: 2022,
      plate: 'AD123CD',
      mileage: 1000,
      color: 'Red',
      description: 'A great car for testing',
      paymentInstructions: 'Payment instructions must be at least 20 chars long',
      photos: ['http://example.com/photo.jpg'],
      documentUrls: [],
      registrationCertificate: 'url',
      proofOfInsurance: 'url',
      technicalInspection: 'url',
      idleAddress: 'Test St',
      idleLat: 0,
      idleLong: 0,
      shifts: [
        { type: 'morning', price: 5000, startTime: '08:00', endTime: '16:00' },
        { type: 'night', price: 6000, startTime: '20:00', endTime: '04:00' }
      ]
    });
    expect(vehicleRes.status).toBe(201);
    const vehicleId = vehicleRes.body.id;
    const shifts = vehicleRes.body.shifts;
    expect(shifts).toHaveLength(2);

    // Approve vehicle (admin)
    await makeAdmin(db, publisher.user.id); // cheating: make publisher admin to self-approve or create admin
    const admin = await ensureUser(app, { email: 'admin@test.com', password: 'password123', name: 'Admin' });
    await makeAdmin(db, admin.user.id);
    await reviewVehicle(app, admin.token, vehicleId, 'approve');

    // 3. Renter applies for vehicle using REAL IDs
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${renter.token}`)
      .send({
        vehicleId: vehicleId,
        selectedDates: [tomorrowStr], // Future date
        selectedShiftIds: [shifts[0].id] // Real shift ID from DB
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(res.body.totalPrice).toBe(5000); // Matches shift price
  });

  it('should return 400 if dates are in the past', async () => {
    const model = await setupModels();
    const publisher = await ensureUser(app, { email: 'pub2@test.com', password: 'password', name: 'Pub2' });
    const renter = await ensureUser(app, { email: 'renter2@test.com', password: 'password', name: 'Renter2' });

    await onboardUser(app, publisher.token, { userId: publisher.user.id, role: 'publisher' });
    await activateSubscription(db, publisher.user.id);
    await onboardUser(app, renter.token, { userId: renter.user.id, role: 'driver' });
    await verifyUser(db, renter.user.id);
    const pubLogin = await request(app).post('/api/auth/login').send({ email: 'pub2@test.com', password: 'password' });
    publisher.token = pubLogin.body.token;

    const vehicleRes = await publishVehicle(app, publisher.token, {
      vehicleModelId: model.id,
      year: 2022,
      plate: 'AD123CD',
      mileage: 1000,
      color: 'Blue',
      description: 'Description must be at least 20 characters long',
      paymentInstructions: 'Payment instructions must be at least 20 chars long',
      photos: ['http://example.com/photo.jpg'],
      documentUrls: [],
      registrationCertificate: 'url',
      proofOfInsurance: 'url',
      technicalInspection: 'url',
      idleAddress: 'Test Address for Past Dates',
      idleLat: 0,
      idleLong: 0,
      shifts: [{ type: 'morning', price: 5000, startTime: '08:00', endTime: '16:00' }]
    });
    const vehicleId = vehicleRes.body.id;
    const shiftId = vehicleRes.body.shifts[0].id;

    // Approve
    const admin = await ensureUser(app, { email: 'admin2@test.com', password: 'password', name: 'Admin2' });
    await makeAdmin(db, admin.user.id);
    await reviewVehicle(app, admin.token, vehicleId, 'approve');

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${renter.token}`)
      .send({
        vehicleId: vehicleId,
        selectedDates: ['2020-01-01'], // Past
        selectedShiftIds: [shiftId]
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('future');
  });

  it('should return 400 if renter verification is missing', async () => {
    const model = await setupModels();
    const publisher = await ensureUser(app, { email: 'pub3@test.com', password: 'password', name: 'Pub3' });
    const renter = await ensureUser(app, { email: 'renter3@test.com', password: 'password', name: 'Renter3' });
    // Renter NOT verified (no verifyUser call)

    await onboardUser(app, publisher.token, { userId: publisher.user.id, role: 'publisher' });
    await activateSubscription(db, publisher.user.id);
    const pubLogin = await request(app).post('/api/auth/login').send({ email: 'pub3@test.com', password: 'password' });
    publisher.token = pubLogin.body.token;

    const vehicleRes = await publishVehicle(app, publisher.token, {
      vehicleModelId: model.id,
      year: 2022,
      plate: 'AA000AA',
      mileage: 1000,
      color: 'Blue',
      description: 'Description must be at least 20 characters long',
      paymentInstructions: 'Payment instructions must be at least 20 chars long',
      photos: ['http://example.com/photo.jpg'],
      documentUrls: [],
      registrationCertificate: 'url',
      proofOfInsurance: 'url',
      technicalInspection: 'url',
      idleAddress: 'Test Address for Verification',
      idleLat: 0,
      idleLong: 0,
      shifts: [{ type: 'morning', price: 5000, startTime: '08:00', endTime: '16:00' }]
    });
    const vehicleId = vehicleRes.body.id;
    const shiftId = vehicleRes.body.shifts[0].id;

    // Approve
    const admin = await ensureUser(app, { email: 'admin3@test.com', password: 'password', name: 'Admin3' });
    await makeAdmin(db, admin.user.id);
    await reviewVehicle(app, admin.token, vehicleId, 'approve');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${renter.token}`)
      .send({
        vehicleId: vehicleId,
        selectedDates: [tomorrowStr],
        selectedShiftIds: [shiftId]
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('verification');
  });

  describe('Application Review (Approve/Reject)', () => {
    // Shared setup for review tests
    let publisher: any;
    let renter: any;
    let applicationId: number;
    let vehicleId: number;

    beforeEach(async () => {
      const model = await setupModels();

      publisher = await ensureUser(app, { email: 'pub_review@test.com', password: 'password123', name: 'PubRev' });
      renter = await ensureUser(app, { email: 'renter_review@test.com', password: 'password123', name: 'RenterRev' });

      await onboardUser(app, publisher.token, { userId: publisher.user.id, role: 'publisher' });
      await activateSubscription(db, publisher.user.id);
      const pubLogin = await request(app).post('/api/auth/login').send({ email: 'pub_review@test.com', password: 'password123' });
      publisher.token = pubLogin.body.token;

      await onboardUser(app, renter.token, { userId: renter.user.id, role: 'driver' });
      await verifyUser(db, renter.user.id);
      const renterLogin = await request(app).post('/api/auth/login').send({ email: 'renter_review@test.com', password: 'password123' });
      renter.token = renterLogin.body.token;

      const vRes = await publishVehicle(app, publisher.token, {
        vehicleModelId: model.id,
        year: 2022,
        plate: 'BB111BB',
        mileage: 1000,
        color: 'Black',
        description: 'Description must be at least 20 characters long',
        paymentInstructions: 'Payment instructions must be at least 20 chars long',
        photos: ['http://example.com/photo.jpg'],
        documentUrls: [],
        registrationCertificate: 'url',
        proofOfInsurance: 'url',
        technicalInspection: 'url',
        idleAddress: 'Long enough address for testing',
        idleLat: 0,
        idleLong: 0,
        shifts: [{ type: 'custom', price: 3000, startTime: '12:00', endTime: '20:00' }]
      });
      vehicleId = vRes.body.id;

      const admin = await ensureUser(app, { email: 'admin_rev@test.com', password: 'password123', name: 'Admin' });
      await makeAdmin(db, admin.user.id);
      await reviewVehicle(app, admin.token, vehicleId, 'approve');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const appRes = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${renter.token}`)
        .send({
          vehicleId: vehicleId,
          selectedDates: [tomorrow.toISOString().split('T')[0]],
          selectedShiftIds: [vRes.body.shifts[0].id]
        });
      applicationId = appRes.body.id;
    });

    it('should approve application and create booking', async () => {
      const res = await request(app)
        .put(`/api/applications/${applicationId}/approve`)
        .set('Authorization', `Bearer ${publisher.token}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.application.status).toBe('approved');
      expect(res.body.booking).toBeDefined();
      expect(['pending_publisher_signature', 'pending_renter_signature', 'pending_payment']).toContain(
        res.body.booking.status
      );
    });

    it('should reject application', async () => {
      const res = await request(app)
        .put(`/api/applications/${applicationId}/reject`)
        .set('Authorization', `Bearer ${publisher.token}`)
        .send();

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
    });

    it('should return 404 if application not found', async () => {
      const res = await request(app)
        .put('/api/applications/99999/approve')
        .set('Authorization', `Bearer ${publisher.token}`)
        .send();

      expect(res.status).toBe(404);
    });
  });
});
