import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import { users, auditLogs, vehicles, vehicleModels } from '@laburauto/shared/schema';
import { eq, and } from 'drizzle-orm';
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

// Mock external services to avoid crashes
vi.mock('../../../src/services/bytescale', () => ({
  uploadBuffer: vi.fn(),
  uploadFile: vi.fn(),
  getSignedUrl: vi.fn((url) => url), // Pass through for tests
}));

import authRouter from '../../../src/routes/auth';
import bookingsRouter from '../../../src/routes/bookings';
import applicationsRouter from '../../../src/routes/applications';
import vehiclesRouter from '../../../src/routes/vehicles';

describe('Audit Trail Integration', () => {
  let app: express.Express;
  let db: any;

  beforeEach(async () => {
    ({ db } = await setupTestDatabase());
    currentTestDb = db;

    app = express();
    app.use(express.json());

    // Mount routes
    app.use('/auth', authRouter);
    app.use('/bookings', bookingsRouter);
    app.use('/applications', applicationsRouter);
    app.use('/vehicles', vehiclesRouter);
  });

  afterEach(async () => {
    await teardownTestDatabase();
    currentTestDb = null;
  });

  it('should audit auth events (register, login)', async () => {
    // Register
    const regRes = await request(app).post('/auth/register').send({
      name: 'New User',
      email: 'audit_test@example.com',
      password: 'password123',
      confirmPassword: 'password123'
    });

    expect(regRes.status).toBe(201);
    const userId = regRes.body.user.id;

    // Verify Audit Log
    const logs = await db.select().from(auditLogs).where(
      and(
        eq(auditLogs.action, 'auth.register'),
        eq(auditLogs.entityId, userId)
      )
    );
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].entityId).toBe(userId);
    expect(logs[0].details.email).toBe('audit_test@example.com');

    // Login
    const loginRes = await request(app).post('/auth/login').send({
      email: 'audit_test@example.com',
      password: 'password123'
    });
    expect(loginRes.status).toBe(200);

    // Verify Login Audit
    const loginLogs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'auth.login'));
    expect(loginLogs.length).toBeGreaterThan(0);
    expect(loginLogs[0].userId).toBe(userId);
  });

  it('should audit vehicle creation', async () => {
    // Create publisher first (id 1 is mocked in middleware but needs to exist in DB for FKs)
    await db.insert(users).values({
      id: 1, name: 'Publisher', email: 'pub@example.com', password: 'hash', role: 'publisher', subscriptionStatus: 'active'
    }).returning();

    // Create model
    const [model] = await db.insert(vehicleModels).values({
      brandName: 'Test', modelName: 'Car', typeName: 'Auto', typeId: 1, brandId: 1, modelId: 1, versionName: 'V1', versionId: 1
    }).returning();

    const res = await request(app)
      .post('/vehicles')
      .set(getAuthHeader(1, 'publisher'))
      .send({
        vehicleModelId: model.id,
        year: 2022,
        plate: 'AD123CD',
        mileage: 1000,
        color: 'Red',
        description: 'Una descripción válida de más de 20 caracteres.',
        photos: ['photo.jpg'],
        documentUrls: [],
        registrationCertificate: 'cert',
        proofOfInsurance: 'ins',
        technicalInspection: 'vtv',
        paymentInstructions: 'Instrucciones de pago válidas de más de 20 caracteres.',
        shifts: [{ type: 'morning', price: 1000, startTime: '08:00', endTime: '16:00' }],
        location: {
          address: 'Calle Falsa 123',
          latitude: 0,
          longitude: 0
        }
      });


    if (res.status !== 201) console.error(res.body);
    expect(res.status).toBe(201);
    const vehicleId = res.body.id;

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'vehicle.create'));
    expect(logs.length).toBe(1);
    expect(logs[0].entityId).toBe(vehicleId);
  });

  it('should audit booking creation', async () => {
    // Setup Data
    await db.insert(users).values([
      { id: 1, name: 'Publisher', email: 'pub@example.com', password: 'hash', role: 'publisher' },
      { id: 2, name: 'Driver', email: 'driver@example.com', password: 'hash', role: 'driver' }
    ]).returning();

    // Create model
    const [model] = await db.insert(vehicleModels).values({
      brandName: 'Test', modelName: 'Car', typeName: 'Auto', typeId: 1, brandId: 1, modelId: 1, versionName: 'V1', versionId: 1
    }).returning();

    const [vehicle] = await db.insert(vehicles).values({
      publisherId: 1, vehicleModelId: model.id, plate: 'BKG123', year: 2020, mileage: 10, color: 'Blue', status: 'active',
      description: 'Test vehicle for booking',
      paymentInstructions: 'Cash'
    }).returning();

    const res = await request(app)
      .post('/bookings')
      .set(getAuthHeader(2, 'driver'))
      .send({
        vehicleId: vehicle.id,
        driverId: 2,
        startDate: '2026-05-01',
        endDate: '2026-05-05',
        selectedShiftIds: [1],
        totalPrice: 5000
      });

    expect(res.status).toBe(201);
    const bookingId = res.body.id;

    const logs = await db.select().from(auditLogs).where(eq(auditLogs.action, 'booking.create'));
    expect(logs.length).toBe(1);
    // expect(logs[0].userId).toBe(2); // driverId passed in log call?
    expect(logs[0].entityId).toBe(bookingId);
  });
});
