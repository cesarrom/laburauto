import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDatabase, teardownTestDatabase } from '../../helpers/test-db';
import bcrypt from 'bcryptjs';
import { users, vehicles, vehicleModels, bookings, shifts, rentalApplications, renterDocuments } from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';

/**
 * HAPPY PATH INTEGRATION TEST
 * 
 * This test covers the complete rental lifecycle using real PostgreSQL database.
 */
describe('Happy Path: Complete Rental Lifecycle', () => {
  let db: Awaited<ReturnType<typeof setupTestDatabase>>['db'];
  let sql: Awaited<ReturnType<typeof setupTestDatabase>>['sql'];

  beforeEach(async () => {
    ({ db, sql } = await setupTestDatabase());
  });

  afterEach(async () => {
    await teardownTestDatabase();
  });

  it('should complete entire rental flow from subscription to return', async () => {
    // ============ PHASE 1: User Registration ============

    // Create publisher
    const publisherPassword = await bcrypt.hash('password123', 10);
    const [publisher] = await db.insert(users).values({
      name: 'Juan Publisher',
      email: 'juan@publisher.com',
      password: publisherPassword,
      role: 'publisher',
      subscriptionStatus: 'active',
    }).returning();

    expect(publisher).toBeDefined();
    expect(publisher.id).toBeDefined();
    const publisherId = publisher.id;

    // Create renter
    const renterPassword = await bcrypt.hash('password456', 10);
    const [renter] = await db.insert(users).values({
      name: 'Sofia Renter',
      email: 'sofia@renter.com',
      password: renterPassword,
      role: 'driver',
    }).returning();

    const renterId = renter.id;

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const [admin] = await db.insert(users).values({
      name: 'Admin User',
      email: 'admin@laburauto.com',
      password: adminPassword,
      role: 'publisher',
    }).returning();

    const adminId = admin.id;

    console.log('✓ Users created:', { publisherId, renterId, adminId });

    // ============ PHASE 2: Vehicle Creation ============

    // Create vehicle model
    const [model] = await db.insert(vehicleModels).values({
      typeName: 'Auto',
      typeId: 1,
      brandName: 'Toyota',
      brandId: 10,
      modelName: 'Corolla',
      modelId: 100,
      versionName: '1.8 XEI',
      versionId: 1000,
    }).returning();

    const modelId = model.id;

    // Publisher creates vehicle
    const [vehicle] = await db.insert(vehicles).values({
      publisherId,
      vehicleModelId: modelId,
      year: 2020,
      plate: 'ABC123',
      mileage: 50000,
      color: 'Gris',
      description: 'Toyota Corolla en excelente estado',
      idleLat: -34.6037,
      idleLong: -58.3816,
      idleAddress: 'Av. Corrientes 1234, Buenos Aires',
      accessInstructions: 'Tocar timbre, preguntar por Juan',
      paymentInstructions: 'Transferencia bancaria a CBU: 0000000000000000000000',
      status: 'pending_review',
    }).returning();

    const vehicleId = vehicle.id;
    expect(vehicle.status).toBe('pending_review');
    console.log('✓ Vehicle created:', vehicleId);

    // ============ PHASE 3: Admin Approves Vehicle ============

    const [approvedVehicle] = await db.update(vehicles)
      .set({
        status: 'active',
        reviewedAt: new Date(),
        reviewedBy: adminId,
      })
      .where(eq(vehicles.id, vehicleId))
      .returning();

    expect(approvedVehicle.status).toBe('active');
    expect(approvedVehicle.reviewedBy).toBe(adminId);
    console.log('✓ Vehicle approved by admin');

    // ============ PHASE 4: Renter Document Verification ============

    const [docs] = await db.insert(renterDocuments).values({
      userId: renterId,
      uberRating: 'https://storage.example.com/uber-5stars.jpg',
      dniPhoto: 'https://storage.example.com/dni-sofia.jpg',
      criminalBackground: 'https://storage.example.com/antecedentes-sofia.pdf',
    }).returning();

    expect(docs).toBeDefined();
    console.log('✓ Renter documents uploaded');

    // ============ PHASE 5: Create Shifts ============

    const [morningShift] = await db.insert(shifts).values({
      vehicleId,
      type: 'morning',
      price: 5000,
      startTime: '06:00',
      endTime: '14:00',
    }).returning();

    const [nightShift] = await db.insert(shifts).values({
      vehicleId,
      type: 'night',
      price: 6000,
      startTime: '14:00',
      endTime: '22:00',
    }).returning();

    console.log('✓ Shifts created');

    // ============ PHASE 6: Renter Applies for Rental ============

    // Application for 2 days (tomorrow and day after)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(6, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const selectedDates = [
      tomorrow.toISOString().split('T')[0],
      dayAfter.toISOString().split('T')[0]
    ];

    const selectedShiftIds = [morningShift.id, morningShift.id];
    const totalPrice = 5000 + 5000; // 2 days @ morning rate

    const [application] = await db.insert(rentalApplications).values({
      vehicleId,
      renterId,
      selectedDates,
      selectedShiftIds,
      totalPrice,
      status: 'pending',
    }).returning();

    const applicationId = application.id;
    expect(application.status).toBe('pending');
    console.log('✓ Rental application created:', applicationId);

    // ============ PHASE 7: Publisher Approves Application ============

    // Calculate payment deadline (2 hours from now for test)
    const paymentDeadline = new Date();
    paymentDeadline.setHours(paymentDeadline.getHours() + 2);

    // Update application to approved
    const [approvedApp] = await db.update(rentalApplications)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        paymentDeadline,
      })
      .where(eq(rentalApplications.id, applicationId))
      .returning();

    expect(approvedApp.status).toBe('approved');

    // Create booking
    const [booking] = await db.insert(bookings).values({
      vehicleId,
      driverId: renterId,
      applicationId,
      startDate: selectedDates[0],
      endDate: selectedDates[1],
      selectedShiftIds,
      totalPrice,
      paymentDeadline,
      status: 'pending_payment',
    }).returning();

    const bookingId = booking.id;
    expect(booking.status).toBe('pending_payment');
    console.log('✓ Booking created:', bookingId);

    // ============ PHASE 8: Renter Uploads Payment Proof ============

    const proofUrl = 'https://storage.example.com/payment-proof-sofia.jpg';
    const [bookingWithProof] = await db.update(bookings)
      .set({
        paymentProofUrl: proofUrl,
        status: 'payment_sent',
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    expect(bookingWithProof.paymentProofUrl).toBe(proofUrl);
    expect(bookingWithProof.status).toBe('payment_sent');
    console.log('✓ Payment proof uploaded');

    // ============ PHASE 9: Publisher Confirms Payment ============

    const [confirmedBooking] = await db.update(bookings)
      .set({
        paymentConfirmedAt: new Date(),
        status: 'confirmed',
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    expect(confirmedBooking.status).toBe('confirmed');
    expect(confirmedBooking.paymentConfirmedAt).toBeDefined();
    console.log('✓ Payment confirmed by publisher');

    // ============ PHASE 10: Location Sharing (Near Pickup Time) ============

    const [locationShared] = await db.update(bookings)
      .set({
        locationSharedAt: new Date(),
        renterCanSeeLocation: true,
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    expect(locationShared.renterCanSeeLocation).toBe(true);
    console.log('✓ Location shared with renter');

    // ============ PHASE 11: Renter Arrives ============

    const [arrivedBooking] = await db.update(bookings)
      .set({
        arrivedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    expect(arrivedBooking.arrivedAt).toBeDefined();
    console.log('✓ Renter declared arrival');

    // ============ PHASE 12: Rental Starts ============

    const [activeBooking] = await db.update(bookings)
      .set({
        status: 'active',
        rentalStartedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    expect(activeBooking.status).toBe('active');
    expect(activeBooking.rentalStartedAt).toBeDefined();
    console.log('✓ Rental activated');

    // ============ PHASE 13: Renter Returns Vehicle ============

    const returnPhotoUrl = 'https://storage.example.com/return-photo-sofia.jpg';
    const [returnedBooking] = await db.update(bookings)
      .set({
        returnedAt: new Date(),
        returnPhotoUrl,
        status: 'completed',
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    expect(returnedBooking.status).toBe('completed');
    expect(returnedBooking.returnPhotoUrl).toBe(returnPhotoUrl);
    console.log('✓ Vehicle returned with photo');

    // ============ PHASE 14: Publisher Confirms Return ============

    const [confirmedReturn] = await db.update(bookings)
      .set({
        returnConfirmedAt: new Date(),
      })
      .where(eq(bookings.id, bookingId))
      .returning();

    expect(confirmedReturn.returnConfirmedAt).toBeDefined();
    console.log('✓ Return confirmed by publisher');

    // ============ FINAL VERIFICATION ============

    const [finalBooking] = await db.query.bookings.findMany({
      where: (bookings, { eq }) => eq(bookings.id, bookingId),
    });

    expect(finalBooking).toMatchObject({
      status: 'completed',
      paymentProofUrl: proofUrl,
      returnPhotoUrl: returnPhotoUrl,
    });

    expect(finalBooking.paymentConfirmedAt).toBeDefined();
    expect(finalBooking.arrivedAt).toBeDefined();
    expect(finalBooking.rentalStartedAt).toBeDefined();
    expect(finalBooking.returnedAt).toBeDefined();
    expect(finalBooking.returnConfirmedAt).toBeDefined();

    console.log('\n🎉 COMPLETE RENTAL LIFECYCLE TEST PASSED!');
  });
});
