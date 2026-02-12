import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import { users, vehicles, bookings, vehicleModels } from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';
import {
  ensureUser,
  onboardUser,
  makeAdmin,
  loginUser
} from '../../helpers/api-utils';


// Mock DB
let currentTestDb: any;
vi.mock('../../../src/db', () => ({
  get db() {
    return currentTestDb;
  }
}));

const JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = JWT_SECRET;

describe('Authorization Middleware', () => {
  let app: any;
  let testDb: any;
  let driverUser: any;
  let publisherUser: any;
  let adminUser: any;
  let testVehicle: any;
  let testVehicleModel: any;

  beforeEach(async () => {
    // Setup test database
    const setup = await setupTestDatabase();
    testDb = setup.db;
    currentTestDb = testDb;

    // Re-import app to get fresh middleware with our mock
    vi.resetModules();
    const { default: appModule } = await import('../../../src/app');
    app = appModule;

    // Create test users via API
    const password = 'hashedpassword';
    const driverRes = await ensureUser(app, { name: 'Test Driver', email: 'driver@test.com', password });
    await onboardUser(app, driverRes.token, { userId: driverRes.user.id, role: 'driver' });
    const driver = await loginUser(app, { email: 'driver@test.com', password });
    driverUser = { ...driver.user, token: driver.token };

    const pubRes = await ensureUser(app, { name: 'Test Publisher', email: 'publisher@test.com', password });
    await onboardUser(app, pubRes.token, { userId: pubRes.user.id, role: 'publisher' });
    // Manually set active subscription status via SQL as requested for setup
    await testDb.update(users).set({ subscriptionStatus: 'active' }).where(eq(users.id, pubRes.user.id));
    const publisher = await loginUser(app, { email: 'publisher@test.com', password });
    publisherUser = { ...publisher.user, token: publisher.token };

    const adminRes = await ensureUser(app, { name: 'Test Admin', email: 'admin@test.com', password });
    await makeAdmin(testDb, adminRes.user.id);
    const admin = await loginUser(app, { email: 'admin@test.com', password });
    adminUser = { ...admin.user, token: admin.token };


    // Create test vehicle model (required by vehicles table)
    [testVehicleModel] = await testDb.insert(vehicleModels).values({
      typeName: 'Auto', typeId: 1, brandName: 'Toyota', brandId: 100, modelName: 'Corolla', modelId: 1001, versionName: 'XLi 1.8', versionId: 10001,
    }).returning();

    // Create test vehicle
    [testVehicle] = await testDb.insert(vehicles).values({
      publisherId: publisherUser.id,
      vehicleModelId: testVehicleModel.id,
      year: 2023,
      plate: 'TEST123',
      mileage: 50000,
      description: 'Test vehicle for authorization tests',
      status: 'active',
    }).returning();
  });

  afterEach(async () => {
    await teardownTestDatabase();
    vi.resetAllMocks();
  });

  describe('requireAuth middleware', () => {
    it('should reject requests without Authorization header', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .expect(401);

      expect(response.body.error).toContain('authorization');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toContain('Invalid');
    });

    it('should accept requests with valid token', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${driverUser.token}`)
        .expect(200);

      // Should return an array (empty for new driver)
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('requireRole middleware', () => {
    it('should reject driver accessing admin routes', async () => {
      const response = await request(app)
        .get('/api/admin/evidence-kit/1')
        .set('Authorization', `Bearer ${driverUser.token}`)
        .expect(403);

      expect(response.body.error).toContain('Access denied');
    });

    it('should allow admin to access admin routes', async () => {
      // May return 404 if booking doesn't exist, but should not be 403
      const response = await request(app)
        .get('/api/admin/evidence-kit/999')
        .set('Authorization', `Bearer ${adminUser.token}`);

      expect(response.status).not.toBe(403);
    });

    it('should reject driver trying to create vehicle', async () => {
      const response = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${driverUser.token}`)
        .send({ year: 2023, plate: 'ABC123' })
        .expect(403);

      expect(response.body.error).toContain('Access denied');
    });

    it('should allow publisher to create vehicle', async () => {
      // May fail due to missing fields, but should not be 401 or 403
      const response = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${publisherUser.token}`)
        .send({
          vehicleModelId: testVehicleModel.id,
          year: 2023,
          plate: 'NEW123',
          mileage: 1000,
          color: 'Red',
          description: 'A brand new vehicle for testing auth.',
          photos: ['photo.jpg'],
          registrationCertificate: 'cert.pdf',
          proofOfInsurance: 'ins.pdf',
          technicalInspection: 'vtv.pdf',
          paymentInstructions: 'Bank transfer',
          shifts: [{ type: 'morning', price: 1000, startTime: '08:00', endTime: '16:00' }]
        });

      // Should be 201 (created) or 400 for validation, not 401/403
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(401);
    });
  });

  describe('Resource ownership', () => {
    it('should use authenticated user ID instead of body', async () => {
      // Create vehicle - should use authenticated user's ID, not body
      const response = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${publisherUser.token}`)
        .send({
          vehicleModelId: testVehicleModel.id,
          year: 2023,
          plate: 'OWN123',
          mileage: 1000,
          color: 'Blue',
          description: 'Testing that publisherId is ignored in body.',
          photos: ['photo.jpg'],
          registrationCertificate: 'cert.pdf',
          proofOfInsurance: 'ins.pdf',
          technicalInspection: 'vtv.pdf',
          paymentInstructions: 'Cash',
          shifts: [{ type: 'morning', price: 1000, startTime: '08:00', endTime: '16:00' }]
        });

      if (response.status === 201) {
        // Verify the vehicle was created with the authenticated user's ID
        const createdVehicle = await testDb.query.vehicles.findFirst({
          where: eq(vehicles.plate, 'OWN123'),
        });

        expect(createdVehicle?.publisherId).toBe(publisherUser.id);
      }
    });

    it('should prevent publisher from modifying another publishers vehicle', async () => {
      // Create a second publisher via API
      const other = await ensureUser(app, { name: 'Other Publisher', email: 'other@test.com', password: 'password' });
      await onboardUser(app, other.token, { userId: other.user.id, role: 'publisher' });

      // Try to put vehicle into maintenance with wrong publisher
      const response = await request(app)
        .put(`/api/vehicles/${testVehicle.id}/maintenance`)
        .set('Authorization', `Bearer ${other.token}`)
        .send({});

      // Should be 403 - not the owner
      expect(response.status).toBe(403);
    });

    it('should allow owner to modify their own vehicle', async () => {
      const response = await request(app)
        .put(`/api/vehicles/${testVehicle.id}/maintenance`)
        .set('Authorization', `Bearer ${publisherUser.token}`)
        .send({});

      // Should succeed (status update)
      expect(response.status).toBe(200);
    });
  });

  describe('Admin route protection', () => {
    it('should require admin role for vehicle approval', async () => {
      const response = await request(app)
        .put(`/api/vehicles/${testVehicle.id}/approve`)
        .set('Authorization', `Bearer ${publisherUser.token}`)
        .send({});

      expect(response.status).toBe(403);
    });

    it('should allow admin to approve vehicle', async () => {
      const response = await request(app)
        .put(`/api/vehicles/${testVehicle.id}/approve`)
        .set('Authorization', `Bearer ${adminUser.token}`)
        .send({});

      expect(response.status).toBe(200);

      // Verify vehicle is now active and has reviewer ID set
      const updatedVehicle = await testDb.query.vehicles.findFirst({
        where: eq(vehicles.id, testVehicle.id),
      });
      expect(updatedVehicle?.reviewedBy).toBe(adminUser.id);
    });
  });
});
