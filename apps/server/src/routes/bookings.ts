import { Router } from 'express';
import { db } from '../db';
import { bookings, notifications, vehicles, shifts, contractTemplates, users } from '@laburauto/shared';
import { createContractInstance } from '../services/contractService';
import { eq, and, lt, inArray } from 'drizzle-orm';
import { AuditService } from '../services/auditService';
import { EmailService } from '../services/emailService';
import { MagicLinkService } from '../services/magicLinkService';
import crypto from 'crypto';
import { requireAuth, requireRole, optionalAuth, requireOwnership } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { createBookingSchema, updateBookingStatusSchema, publishVehicleSchema } from '@laburauto/shared/zod';

const router = Router();

// Create Booking
router.post('/', requireAuth, validateRequest({ body: createBookingSchema }), async (req, res) => {
  // Create Booking manually (if needed)
  const { vehicleId, selectedShiftIds, startDate, endDate, totalPrice } = req.body;
  const driverId = req.user!.id;
  try {
    const [booking] = await db.insert(bookings).values({
      vehicleId,
      driverId,
      selectedShiftIds,
      startDate,
      endDate,
      totalPrice,
      status: 'pending_payment',
    }).returning();

    // Fetch publisher to notify? Maybe later on status change.
    // For now just return booking.
    AuditService.log(driverId, 'booking.create', 'booking', booking.id, { totalPrice, vehicleId }, req);
    res.status(201).json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Status (Workflow)
router.put('/:id/status', requireAuth, requireRole('admin'), validateRequest({ body: updateBookingStatusSchema }), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  // Valid statuses: 'pending_payment', 'payment_sent', 'confirmed', 'active', 'completed', 'cancelled'

  try {
    // 1. Update booking
    const [updatedBooking] = await db.update(bookings)
      .set({ status })
      .where(eq(bookings.id, parseInt(id as string)))
      .returning();

    if (!updatedBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // 2. Handle Notifications
    if (status === 'payment_sent') {
      // Notify Publisher
      // Need to fetch vehicle -> publisherId
      const vehicle = await db.query.vehicles.findFirst({
        where: eq(vehicles.id, updatedBooking.vehicleId),
      });
      if (vehicle) {
        await db.insert(notifications).values({
          userId: vehicle.publisherId,
          type: 'booking_payment_sent',
          message: `Payment sent for booking #${updatedBooking.id}`,
          relatedEntityId: updatedBooking.id,
        });
      }
    } else if (status === 'confirmed') {
      // Notify Driver
      await db.insert(notifications).values({
        userId: updatedBooking.driverId,
        type: 'booking_confirmed',
        message: `Booking #${updatedBooking.id} confirmed!`,
        relatedEntityId: updatedBooking.id,
      });
    }

    AuditService.log(null, 'booking.status_update', 'booking', updatedBooking.id, { oldStatus: 'unknown', newStatus: status }, req);
    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user bookings - requires auth, scoped to authenticated user
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Driver: get their own bookings
    if (userRole === 'driver') {
      const result = await db.query.bookings.findMany({
        where: eq(bookings.driverId, userId),
        with: { vehicle: { with: { vehicleModel: true } } },
        orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
      });
      return res.json(result);
    }

    // Publisher: get bookings for their vehicles
    if (userRole === 'publisher') {
      const myVehicles = await db.select({ id: vehicles.id })
        .from(vehicles)
        .where(eq(vehicles.publisherId, userId));
      const vehicleIds = myVehicles.map(v => v.id);

      if (vehicleIds.length === 0) return res.json([]);

      const result = await db.query.bookings.findMany({
        where: inArray(bookings.vehicleId, vehicleIds),
        with: { vehicle: { with: { vehicleModel: true } }, driver: { columns: { id: true, name: true, email: true } } },
        orderBy: (bookings, { desc }) => [desc(bookings.createdAt)],
      });
      return res.json(result);
    }

    // Admin: can see all (or return empty for now)
    res.json([]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============ NEW FLOWS ============

// Payment Fraud Prevention - requires auth, ownership check inside
router.post('/:id/payment/proof', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { proofUrl } = req.body;
  const userId = req.user!.id;

  try {
    if (!proofUrl) {
      return res.status(400).json({ error: 'Payment proof URL is required' });
    }

    // First verify the user owns this booking
    const existingBooking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
    });

    if (!existingBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only the driver can upload payment proof
    if (existingBooking.driverId !== userId) {
      return res.status(403).json({ error: 'Only the booking driver can upload payment proof' });
    }

    // Calculate hash of the proof image for tamper detection
    let proofHash: string | null = null;
    try {
      const response = await fetch(proofUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        proofHash = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
      }
    } catch (err) {
      console.warn('Could not fetch proof URL for hashing:', err);
    }

    const [booking] = await db.update(bookings)
      .set({
        paymentProofUrl: proofUrl,
        paymentProofHash: proofHash,
        status: 'payment_sent',
      })
      .where(eq(bookings.id, parseInt(id as string)))
      .returning();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Notify publisher
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, booking.vehicleId),
    });

    if (vehicle) {
      await db.insert(notifications).values({
        userId: vehicle.publisherId,
        type: 'booking_payment_sent',
        message: `Payment proof uploaded for booking #${booking.id}. Please review.`,
        relatedEntityId: booking.id,
      });
    }

    AuditService.log(booking.driverId, 'booking.payment_proof_uploaded', 'booking', booking.id, { proofUrl, proofHash }, req);
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/payment/proof', async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      paymentProofUrl: booking.paymentProofUrl,
      paymentConfirmedAt: booking.paymentConfirmedAt,
      disputeStatus: booking.disputeStatus,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/payment/confirm-receipt', requireAuth, async (req, res) => {
  const { id } = req.params;
  const publisherId = req.user!.id;

  try {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
      with: { vehicle: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify publisher owns this vehicle
    if (booking.vehicle.publisherId !== publisherId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Verify contract exists
    if (!booking.contractId) {
      // Emergency Fallback: If for some reason contract wasn't created on approval, create it now (legacy support)
      // But ideally we should just error or handle it. For now, let's keep it robust but warn.
      console.warn('Booking confirmed without pre-existing contract. This shouldn\'t happen with new flow.');
    }

    const [updatedBooking] = await db.update(bookings)
      .set({
        paymentConfirmedAt: new Date(),
        status: 'confirmed',
      })
      .where(eq(bookings.id, parseInt(id as string)))
      .returning();

    // Notify renter
    await db.insert(notifications).values({
      userId: booking.driverId,
      type: 'booking_confirmed',
      message: `Payment confirmed! Booking #${booking.id} is now active.`,
      relatedEntityId: booking.id,
    });

    AuditService.log(publisherId, 'booking.payment_confirmed', 'booking', updatedBooking.id, {}, req);
    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/payment/dispute', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { disputeNotes } = req.body;
  const userId = req.user!.id;

  try {
    const [booking] = await db.update(bookings)
      .set({
        disputeStatus: 'pending',
        disputeNotes,
      })
      .where(eq(bookings.id, parseInt(id as string)))
      .returning();

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Fetch related data to determine who filed
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, booking.vehicleId),
    });

    // Audit log the dispute filing
    // Determine if filer is driver or publisher
    let filedBy = 'unknown';
    if (booking.driverId === userId) filedBy = 'renter';
    else if (vehicle?.publisherId === userId) filedBy = 'publisher';

    if (filedBy === 'unknown') {
      return res.status(403).json({ error: 'Only involved parties can file a dispute' });
    }

    AuditService.log(
      userId,
      'booking.dispute_filed',
      'booking',
      booking.id,
      { filedBy, disputeNotes, paymentProofUrl: booking.paymentProofUrl, paymentProofHash: booking.paymentProofHash },
      req
    );

    // Notify both parties and admin (future: support team)
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Location Sharing
router.get('/:id/vehicle-location', async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
      with: { vehicle: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check timing: within 2 hours of pickup AND status is confirmed or active
    const now = new Date();
    const startDate = new Date(booking.startDate);
    const hoursUntilPickup = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    const canSeeLocation =
      hoursUntilPickup <= 2 &&
      ['confirmed', 'active'].includes(booking.status as string);

    if (!canSeeLocation) {
      return res.status(403).json({
        error: 'Location not yet available',
        availableAt: new Date(startDate.getTime() - 2 * 60 * 60 * 1000),
      });
    }

    // Mark location as shared
    if (!booking.locationSharedAt) {
      await db.update(bookings)
        .set({
          locationSharedAt: new Date(),
          renterCanSeeLocation: true,
        })
        .where(eq(bookings.id, parseInt(id as string)));
    }

    res.json({
      location: {
        lat: booking.vehicle.idleLat,
        long: booking.vehicle.idleLong,
        address: booking.vehicle.idleAddress,
      },
      accessInstructions: booking.vehicle.accessInstructions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Arrival Declaration
router.post('/:id/arrive', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
      with: { vehicle: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only the driver can arrive
    if (booking.driverId !== userId) {
      return res.status(403).json({ error: 'Only the driver can declare arrival' });
    }

    // Check if within ±30 min of start time
    const now = new Date();
    const startDate = new Date(booking.startDate);
    const diffMinutes = Math.abs((startDate.getTime() - now.getTime()) / (1000 * 60));

    if (diffMinutes > 30) {
      return res.status(400).json({
        error: 'Can only declare arrival within 30 minutes of rental start time'
      });
    }

    const [updatedBooking] = await db.update(bookings)
      .set({ arrivedAt: new Date() })
      .where(eq(bookings.id, parseInt(id as string)))
      .returning();

    // Notify publisher
    await db.insert(notifications).values({
      userId: booking.vehicle.publisherId,
      type: 'booking_arrival',
      message: `Driver has arrived at the vehicle location for booking #${booking.id}`,
      relatedEntityId: booking.id,
    });

    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start Rental
router.post('/:id/start-rental', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only the driver can start the rental
    if (booking.driverId !== userId) {
      return res.status(403).json({ error: 'Only the driver can start the rental' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Booking must be confirmed to start rental' });
    }

    if (!booking.contractFullySigned) {
      return res.status(400).json({ error: 'Rental agreement must be signed by both parties before starting' });
    }

    const [updatedBooking] = await db.update(bookings)
      .set({
        status: 'active',
        rentalStartedAt: new Date(),
      })
      .where(eq(bookings.id, parseInt(id as string)))
      .returning();

    AuditService.log(booking.driverId, 'booking.rental_started', 'booking', updatedBooking.id, {}, req);
    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Vehicle Return
router.post('/:id/return', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { returnPhotoUrl } = req.body;
  const userId = req.user!.id;

  try {
    if (!returnPhotoUrl) {
      return res.status(400).json({ error: 'Return photo is required' });
    }

    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
      with: { vehicle: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Only the driver can return the vehicle
    if (booking.driverId !== userId) {
      return res.status(403).json({ error: 'Only the driver can return the vehicle' });
    }

    const [updatedBooking] = await db.update(bookings)
      .set({
        returnedAt: new Date(),
        returnPhotoUrl,
        status: 'completed',
      })
      .where(eq(bookings.id, parseInt(id as string)))
      .returning();

    // Notify publisher
    await db.insert(notifications).values({
      userId: booking.vehicle.publisherId,
      type: 'booking_returned',
      message: `Vehicle returned for booking #${booking.id}. Please verify condition.`,
      relatedEntityId: booking.id,
    });

    AuditService.log(booking.driverId, 'booking.vehicle_returned', 'booking', updatedBooking.id, { returnPhotoUrl }, req);
    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/return/confirm', requireAuth, async (req, res) => {
  const { id } = req.params;
  const publisherId = req.user!.id;

  try {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
      with: { vehicle: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.vehicle.publisherId !== publisherId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const [updatedBooking] = await db.update(bookings)
      .set({ returnConfirmedAt: new Date() })
      .where(eq(bookings.id, parseInt(id as string)))
      .returning();

    AuditService.log(publisherId, 'booking.return_confirmed', 'booking', updatedBooking.id, {}, req);
    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Publisher Cancellation
router.get('/:id/cancellation-eligibility', async (req, res) => {
  const { id } = req.params;

  try {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const canCancel = ['pending_payment', 'payment_sent', 'confirmed'].includes(booking.status as string);
    const requiresRefund = ['payment_sent', 'confirmed'].includes(booking.status as string);

    res.json({
      canCancel,
      requiresRefund,
      currentStatus: booking.status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/cancel-by-publisher', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const publisherId = req.user!.id;

  try {
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
      with: { vehicle: true },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.vehicle.publisherId !== publisherId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (booking.status === 'active') {
      return res.status(400).json({
        error: 'Cannot cancel active rental. Contact support.'
      });
    }

    const needsRefund = ['payment_sent', 'confirmed'].includes(booking.status as string);

    const [updatedBooking] = await db.update(bookings)
      .set({
        status: 'cancelled',
        cancelledBy: 'publisher',
        cancellationReason: reason,
        cancelledAt: new Date(),
        refundStatus: needsRefund ? 'pending' : 'none',
      })
      .where(eq(bookings.id, parseInt(id as string)))
      .returning();

    // Notify renter
    await db.insert(notifications).values({
      userId: booking.driverId,
      type: 'booking_cancelled',
      message: `Your booking #${booking.id} was cancelled by the publisher. ${needsRefund ? 'Refund will be processed.' : ''}`,
      relatedEntityId: booking.id,
    });

    AuditService.log(publisherId, 'booking.cancelled', 'booking', updatedBooking.id, { reason, cancelledBy: 'publisher' }, req);
    res.json(updatedBooking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Auto-Expiration (Cron endpoint)
router.post('/expire-outdated', async (req, res) => {
  try {
    const now = new Date();

    // Find pre-payment bookings that are past deadline
    const expiredBookings = await db.update(bookings)
      .set({
        status: 'expired',
        cancelledBy: 'system',
        cancelledAt: now,
      })
      .where(
        and(
          inArray(bookings.status, ['pending_publisher_signature', 'pending_renter_signature', 'pending_payment']),
          lt(bookings.paymentDeadline, now)
        )
      )
      .returning();

    // Notify renters
    for (const booking of expiredBookings) {
      await db.insert(notifications).values({
        userId: booking.driverId,
        type: 'booking_expired',
        message: `Booking #${booking.id} expired due to payment timeout.`,
        relatedEntityId: booking.id,
      });
    }

    // Audit for system action
    if (expiredBookings.length > 0) {
      AuditService.log(null, 'system.expire_bookings', 'booking_batch', 0, { count: expiredBookings.length, bookingIds: expiredBookings.map(b => b.id) }, req);
    }

    res.json({
      expiredCount: expiredBookings.length,
      bookingIds: expiredBookings.map(b => b.id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
