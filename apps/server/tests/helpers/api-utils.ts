import request from 'supertest';
import { eq } from 'drizzle-orm';
import * as schema from '@laburauto/shared/schema';

/**
 * Ensures a user exists. Attempts login first, then register if not found.
 */
export async function ensureUser(app: any, userData: { email: string; password: string; name?: string }) {
  // Try logging in
  let response = await request(app)
    .post('/api/auth/login')
    .send({ email: userData.email, password: userData.password });

  if (response.status === 200) {
    return {
      response,
      token: response.body.token,
      user: response.body.user,
    };
  }

  // If login failed, register
  response = await request(app)
    .post('/api/auth/register')
    .send({
      name: userData.name || 'Test User',
      email: userData.email,
      password: userData.password,
      confirmPassword: userData.password,
    });

  if (response.status === 201) {
    return {
      response,
      token: response.body.token,
      user: response.body.user,
    };
  }

  throw new Error(`Failed to ensure user: ${JSON.stringify(response.body)}`);
}

/**
 * Logins a user and returns the token and user data.
 */
export async function loginUser(app: any, credentials: { email: string; password: string }) {
  const res = await request(app)
    .post('/api/auth/login')
    .send(credentials);

  if (res.status !== 200) {
    throw new Error(`Login failed: ${JSON.stringify(res.body)}`);
  }

  return {
    token: res.body.token,
    user: res.body.user,
  };
}


/**
 * Directly updates a user's role to admin in the database.
 */
export async function makeAdmin(db: any, userId: number) {
  await db
    .update(schema.users)
    .set({ role: 'admin' })
    .where(eq(schema.users.id, userId));
}

/**
 * Directly activates a user's subscription in the database.
 */
export async function activateSubscription(db: any, userId: number) {
  await db
    .update(schema.users)
    .set({ subscriptionStatus: 'active' })
    .where(eq(schema.users.id, userId));
}

/**
 * Directly verifies a user in the database (by adding renter documents).
 */
export async function verifyUser(db: any, userId: number) {
  try {
    await db.insert(schema.renterDocuments).values({
      userId,
      dniPhoto: 'mock-dni.jpg',
      criminalBackground: 'mock-background.pdf',
      uberRating: '5.0',
    });
  } catch (error: any) {
    // Ignore unique constraint violation (already verified)
    if (!error.message.includes('unique constraint') && !error.code?.includes('23505')) {
      throw error;
    }
  }
}


/**
 * Completes user onboarding and optionally uploads renter documents.
 */
export async function onboardUser(
  app: any,
  token: string,
  payload: { userId: number; role: 'publisher' | 'driver'; kycData?: string; documents?: any }
) {
  // Complete kyc/onboarding
  const onboardingRes = await request(app)
    .post('/api/auth/complete-onboarding')
    .set('Authorization', `Bearer ${token}`)
    .send({
      userId: payload.userId,
      role: payload.role,
      kycData: payload.kycData || '{"mock":"kyc"}',
    });

  if (payload.role === 'driver' && payload.documents) {
    await request(app)
      .post('/api/renter-documents')
      .set('Authorization', `Bearer ${token}`)
      .send({
        userId: payload.userId,
        ...payload.documents,
      });
  }

  // Publishers need to sign the enrollment contract to complete onboarding
  if (payload.role === 'publisher') {
    const user = onboardingRes.body.user;
    if (user && user.enrollmentContractId) {
      await request(app)
        .post(`/api/contracts/instances/${user.enrollmentContractId}/sign`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          fields: {},
          auditEvent: {
            userId: payload.userId,
            action: 'signed',
            timestamp: new Date().toISOString(),
            isFinal: true
          }
        });
    }

    // AI-TODO: a publisher can onboard without an active subscription, it will need to subscribe in order to publish a vehicle, so create a new helper to subscribe, and another to dispute a payment, and another to cancel the subscription
  }

  return onboardingRes;
}

/**
 * Publishes a new vehicle.
 */
export async function publishVehicle(app: any, token: string, vehicleInfo: any) {
  return request(app)
    .post('/api/vehicles')
    .set('Authorization', `Bearer ${token}`)
    .send(vehicleInfo);
}

/**
 * Admin reviews a vehicle (approve/reject).
 */
export async function reviewVehicle(app: any, token: string, vehicleId: number, action: 'approve' | 'reject', reason?: string) {
  return request(app)
    .put(`/api/vehicles/${vehicleId}/${action}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ reason });
}

/**
 * Renter applies for a vehicle.
 */
export async function applyForVehicle(app: any, token: string, applicationInfo: any) {
  return request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${token}`)
    .send(applicationInfo);
}

/**
 * Publisher reviews a rental application.
 */
export async function reviewApplication(app: any, token: string, applicationId: number, action: 'approve' | 'reject') {
  return request(app)
    .put(`/api/applications/${applicationId}/${action}`)
    .set('Authorization', `Bearer ${token}`)
    .send();
}

/**
 * Creates a booking (usually after application approval).
 */
export async function createBooking(app: any, token: string, bookingInfo: any) {
  return request(app)
    .post('/api/bookings')
    .set('Authorization', `Bearer ${token}`)
    .send(bookingInfo);
}

/**
 * Updates a booking status.
 */
export async function updateBookingStatus(app: any, token: string, bookingId: number, status: string) {
  return request(app)
    .put(`/api/bookings/${bookingId}/status`)
    .set('Authorization', `Bearer ${token}`)
    .send({ status });
}

/**
 * Signs a contract (unified endpoint).
 */
export async function signContract(app: any, token: string, contractId: number, payload: any) {
  return request(app)
    .post(`/api/contracts/instances/${contractId}/sign`)
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
}

/**
 * Creates a contract template.
 */
export async function createContractTemplate(app: any, token: string, templateData: any) {
  return request(app)
    .post('/api/contracts/templates')
    .set('Authorization', `Bearer ${token}`)
    .send(templateData);
}

/**
 * Uploads payment proof for a booking.
 */
export async function uploadPaymentProof(app: any, token: string, bookingId: number, proofUrl: string) {
  return request(app)
    .post(`/api/bookings/${bookingId}/payment/proof`)
    .set('Authorization', `Bearer ${token}`)
    .send({ proofUrl });
}

/**
 * Publisher confirms receipt of payment.
 */
export async function confirmReceipt(app: any, token: string, bookingId: number) {
  return request(app)
    .post(`/api/bookings/${bookingId}/payment/confirm-receipt`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
}

/**
 * Renter arrives at the vehicle.
 */
export async function arriveAtVehicle(app: any, token: string, bookingId: number) {
  return request(app)
    .post(`/api/bookings/${bookingId}/arrive`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
}

/**
 * Renter starts the rental.
 */
export async function startRental(app: any, token: string, bookingId: number) {
  return request(app)
    .post(`/api/bookings/${bookingId}/start-rental`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
}

/**
 * Renter returns the vehicle.
 */
export async function returnVehicle(app: any, token: string, bookingId: number, payload: any) {
  return request(app)
    .post(`/api/bookings/${bookingId}/return`)
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
}

/**
 * Publisher disputes a payment.
 */
export async function disputePayment(app: any, token: string, bookingId: number, disputeNotes: string) {
  return request(app)
    .post(`/api/bookings/${bookingId}/payment/dispute`)
    .set('Authorization', `Bearer ${token}`)
    .send({ disputeNotes });
}

/**
 * Publisher cancels a booking.
 */
export async function cancelByPublisher(app: any, token: string, bookingId: number, reason: string) {
  return request(app)
    .post(`/api/bookings/${bookingId}/cancel-by-publisher`)
    .set('Authorization', `Bearer ${token}`)
    .send({ reason });
}

/**
 * Gets vehicle location for a booking.
 */
export async function getVehicleLocation(app: any, token: string, bookingId: number) {
  return request(app)
    .get(`/api/bookings/${bookingId}/vehicle-location`)
    .set('Authorization', `Bearer ${token}`);
}

/**
 * Commands the system to expire outdated bookings.
 */
export async function expireOutdatedBookings(app: any) {
  return request(app)
    .post('/api/bookings/expire-outdated')
    .send();
}

/**
 * Submits a photo audit for a booking.
 */
export async function submitPhotoAudit(app: any, token: string, data: any) {
  return request(app)
    .post('/api/audits')
    .set('Authorization', `Bearer ${token}`)
    .send(data);
}

/**
 * Gets the evidence kit for an admin.
 */
export async function getEvidenceKit(app: any, token: string, bookingId: number) {
  return request(app)
    .get(`/api/admin/evidence-kit/${bookingId}`)
    .set('Authorization', `Bearer ${token}`);
}




