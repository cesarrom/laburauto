import { Router } from 'express';
import { db } from '../db';
import { rentalApplications, notifications, vehicles, bookings, renterDocuments, shifts, vehicleModels, users } from '@laburauto/shared/schema';
import { ensureDocusealSubmissionForInstance } from './contracts';


import { eq, and, inArray } from 'drizzle-orm';
import { getSignedUrl } from '../services/bytescale';
import { AuditService } from '../services/auditService';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { createRentalApplicationSchema } from '@laburauto/shared/zod';
import { MagicLinkService } from '../services/magicLinkService';
import { EmailService } from '../services/emailService';

const router = Router();

// Helper: Calculate payment deadline based on formula:
// Min(Max(timeLeftUntilDate - 1 hour, 2 hours), 12 hours)
function calculatePaymentDeadline(firstRentalDate: string): Date {
  const now = new Date();
  const rentalStart = new Date(firstRentalDate);

  // Time left until rental in milliseconds
  const timeLeftMs = rentalStart.getTime() - now.getTime();

  // Convert to hours
  const timeLeftHours = timeLeftMs / (1000 * 60 * 60);

  // Apply formula: Min(Max(timeLeftUntilDate - 1, 2), 12)
  const deadlineHours = Math.min(Math.max(timeLeftHours - 1, 2), 12);

  // Calculate deadline timestamp
  const deadline = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);

  return deadline;
}

// Create new rental application - requires auth (driver)
router.post('/', requireAuth, validateRequest({ body: createRentalApplicationSchema }), async (req, res) => {
  // Use authenticated user as the renter
  const renterId = req.user!.id;
  const { vehicleId, selectedDates, selectedShiftIds } = req.body;

  try {
    // Verify renter has completed document verification
    const docs = await db.select().from(renterDocuments).where(eq(renterDocuments.userId, renterId));
    if (docs.length === 0) {
      return res.status(400).json({ error: 'Please complete renter verification before applying' });
    }

    // Check if dates are in the future
    const now = new Date();
    for (const date of selectedDates) {
      if (new Date(date) <= now) {
        return res.status(400).json({ error: `Date ${date} must be in the future` });
      }
    }

    // Check for existing approved/pending applications for these slots
    // TODO: In a production app, you'd check slot availability more thoroughly
    // For now, we'll allow multiple pending applications

    // Fetch shift prices and calculate total
    const uniqueShiftIds: number[] = [...new Set(selectedShiftIds)].map(id => Number(id)).filter(id => !isNaN(id));
    const shiftRecords = await db.select().from(shifts).where(inArray(shifts.id, uniqueShiftIds));

    const shiftPriceMap = new Map(shiftRecords.map(s => [s.id, s.price]));

    let totalPrice = 0;
    for (const shiftId of selectedShiftIds) {
      const price = shiftPriceMap.get(shiftId);
      if (!price) {
        return res.status(400).json({ error: `Invalid shift ID: ${shiftId}` });
      }
      totalPrice += price;
    }

    // Create application
    const [application] = await db.insert(rentalApplications).values({
      vehicleId,
      renterId,
      selectedDates, // jsonb field, pass array directly
      selectedShiftIds, // jsonb field, pass array directly
      totalPrice,
      status: 'pending',
    }).returning();

    // Notify publisher
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, vehicleId),
    });

    if (vehicle) {
      await db.insert(notifications).values({
        userId: vehicle.publisherId,
        type: 'new_application',
        message: `New rental application for ${selectedDates.length} day(s)! Please review quickly.`,
        relatedEntityId: application.id,
      });
    }

    AuditService.log(renterId, 'application.create', 'application', application.id, { totalPrice, vehicleId }, req);
    res.status(201).json(application);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get applications - requires auth, scoped by role
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const userRole = req.user!.role;

  try {
    // Driver/Renter: get their own applications
    if (userRole === 'driver') {
      const apps = await db.query.rentalApplications.findMany({
        where: eq(rentalApplications.renterId, userId),
        with: {
          vehicle: {
            with: { vehicleModel: true }
          },
        },
        orderBy: (rentalApplications, { desc }) => [desc(rentalApplications.createdAt)],
      });
      return res.json(apps);
    }

    // Publisher: get applications for their vehicles
    if (userRole === 'publisher') {
      const myVehicles = await db.select({ id: vehicles.id })
        .from(vehicles)
        .where(eq(vehicles.publisherId, userId));

      const vehicleIds = myVehicles.map(v => v.id);

      if (vehicleIds.length === 0) {
        return res.json([]);
      }

      // Get all applications for these vehicles
      const appsResult = await db.query.rentalApplications.findMany({
        where: (rentalApplications, { inArray }) => inArray(rentalApplications.vehicleId, vehicleIds),
        with: {
          vehicle: {
            with: { vehicleModel: true }
          },
          renter: {
            columns: {
              id: true,
              name: true,
              email: true,
            }
          },
          bookings: true,
        },
        orderBy: (rentalApplications, { desc }) => [desc(rentalApplications.createdAt)],
      });

      // Transform to include single booking object (take the most recent one if multiple, though logically 1:1)
      const apps = appsResult.map(app => ({
        ...app,
        booking: app.bookings && app.bookings.length > 0 ? app.bookings[0] : null,
      }));

      return res.json(apps);
    }

    // Admin: return empty for now (or implement all-applications view)
    res.json([]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single application with full renter profile
router.get('/:id', requireAuth, requireRole('publisher'), async (req, res) => {
  const { id } = req.params;

  try {
    const application = await db.query.rentalApplications.findFirst({
      where: eq(rentalApplications.id, parseInt(id as string)),
      with: {
        vehicle: {
          with: { vehicleModel: true }
        },
        renter: {
          columns: {
            id: true,
            name: true,
            email: true,
            kycData: true,
          }
        },
      },
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const docs = await db.query.renterDocuments.findFirst({
      where: eq(renterDocuments.userId, application.renterId),
    });

    // Determine if we need to sign these documents
    // Renter documents are sensitive; we should sign them if they are found.
    const signedDocs = docs ? {
      ...docs,
      uberRating: docs.uberRating ? getSignedUrl(docs.uberRating) : null,
      cabifyRating: docs.cabifyRating ? getSignedUrl(docs.cabifyRating) : null,
      indriveRating: docs.indriveRating ? getSignedUrl(docs.indriveRating) : null,
      didiRating: docs.didiRating ? getSignedUrl(docs.didiRating) : null,
      criminalBackground: docs.criminalBackground ? getSignedUrl(docs.criminalBackground) : null,
      dniPhoto: docs.dniPhoto ? getSignedUrl(docs.dniPhoto) : null,
    } : null;

    // Get shift details (selectedShiftIds is already an array from jsonb)
    const shiftIds = application.selectedShiftIds as number[];
    const uniqueShiftIds = [...new Set(shiftIds)];
    const shiftRecords = await db.select().from(shifts).where(inArray(shifts.id, uniqueShiftIds));

    res.json({
      ...application,
      renterDocuments: signedDocs,
      shifts: shiftRecords,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve application (creates booking with payment deadline)
router.put('/:id/approve', requireAuth, requireRole('publisher'), async (req, res) => {
  const { id } = req.params;

  try {
    const application = await db.query.rentalApplications.findFirst({
      where: eq(rentalApplications.id, parseInt(id as string)),
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // selectedDates is already an array from jsonb
    const selectedDates = application.selectedDates as string[];
    const firstDate = selectedDates[0];
    const lastDate = selectedDates[selectedDates.length - 1];

    // Calculate payment deadline
    const paymentDeadline = calculatePaymentDeadline(firstDate);

    // Update application status
    const [updatedApplication] = await db.update(rentalApplications)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        paymentDeadline,
      })
      .where(eq(rentalApplications.id, parseInt(id as string)))
      .returning();

    // Create booking
    const [booking] = await (db).insert(bookings).values({
      vehicleId: application.vehicleId,
      driverId: application.renterId,
      applicationId: application.id,
      startDate: firstDate,
      endDate: lastDate,
      selectedShiftIds: application.selectedShiftIds,
      totalPrice: application.totalPrice,
      paymentDeadline,
      status: 'pending_publisher_signature',
    }).returning();

    if (!booking) {
      console.error('Failed to create booking for application:', application.id);
    } else {
      console.log('Successfully created booking:', booking.id, 'for application:', application.id);
    }

    const vehicle = await (db).query.vehicles.findFirst({
      where: (table, { eq }) => eq(table.id, application.vehicleId),
    });

    if (!vehicle) {
      console.error('DEBUG: Vehicle not found for application.vehicleId:', application.vehicleId);
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const [publisherUser, renterUser] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, vehicle.publisherId) }),
      db.query.users.findFirst({ where: eq(users.id, application.renterId) })
    ]);

    // Create contract instance using pure Docuseal flow
    const [instance] = await db.insert(contractInstances).values({
      contractType: 'rental_agreement',
      publisherId: vehicle.publisherId,
      renterId: application.renterId,
      bookingId: booking.id,
      status: 'pending',
      auditLog: [{
        stage: 'created',
        userId: req.user!.id,
        timestamp: new Date().toISOString(),
        action: 'created'
      }]
    }).returning();

    const contractInstance = (await ensureDocusealSubmissionForInstance(instance.id, req.user!.id)) || instance;
    
    // Link contract back to booking
    await (db).update(bookings).set({ contractId: instance.id }).where(eq(bookings.id, booking.id));

    // Send Email Invitation to Publisher
    if (publisherUser) {
      try {
        const signingUrl = contractInstance.docusealPublisherSignUrl || await MagicLinkService.createLink(
          publisherUser.id,
          `/portal/contracts/${instance.id}`,
          req
        );

        await EmailService.sendSigningInvitation({
          email: publisherUser.email,
          magicLink: signingUrl,
          role: 'publisher',
          contractId: instance.id,
          bookingId: booking.id,
        });
      } catch (emailErr) {
        console.error('Failed to send signing invitation:', emailErr);
      }
    }

    // Get the updated booking to return it
    const [updatedBooking] = await (db).select().from(bookings).where(eq(bookings.id, booking.id));
    
    // Notify renter
    await (db).insert(notifications).values({
      userId: application.renterId,
      type: 'application_approved',
      message: `Your rental application was approved! The publisher is now preparing the rental agreement for you to sign.`,
      relatedEntityId: booking.id,
    });

    AuditService.log(null, 'application.approved', 'application', updatedApplication.id, { bookingId: booking.id }, req);
    res.json({ application: updatedApplication, booking: updatedBooking, contractInstance: instance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reject application
router.put('/:id/reject', requireAuth, requireRole('publisher'), async (req, res) => {
  const { id } = req.params;

  try {
    const [application] = await db.update(rentalApplications)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
      })
      .where(eq(rentalApplications.id, parseInt(id as string)))
      .returning();

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // Notify renter
    await db.insert(notifications).values({
      userId: application.renterId,
      type: 'application_rejected',
      message: `Your rental application was not approved.`,
      relatedEntityId: application.id,
    });

    AuditService.log(null, 'application.rejected', 'application', application.id, {}, req);
    res.json(application);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Check availability for a vehicle/shift on specific dates
router.get('/vehicles/:vehicleId/availability', async (req, res) => {
  const { vehicleId } = req.params;
  const { dates, shiftId } = req.query;

  try {
    if (!dates || !shiftId) {
      return res.status(400).json({ error: 'dates and shiftId are required' });
    }

    // dates parameter is a JSON string from query param, needs parsing
    const dateArray = JSON.parse(dates as string);

    // Get all active/pending bookings for this vehicle
    const existingBookings = await db.select()
      .from(bookings)
      .where(
        and(
          eq(bookings.vehicleId, parseInt(vehicleId as string)),
          inArray(bookings.status, ['pending_payment', 'payment_sent', 'confirmed', 'active'])
        )
      );

    // Check which dates have conflicts
    const unavailableDates = new Set<string>();

    for (const booking of existingBookings) {
      // Parse dates from booking range
      // For simplicity in this demo, we'll iterate booking dates
      // In production, better range overlap logic needed

      const bookingShiftIds = booking.selectedShiftIds as number[];
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];

        // If this date is in the requested check list
        if (dateArray.includes(dateStr)) {
          // Check if the requested shift matches any booked shift for this booking
          // Note: booking.selectedShiftIds maps to dates. 
          // Schema: selectedShiftIds is array of shiftIds corresponding to the date range?
          // Wait, the schema says: selectedShiftIds: jsonb('selected_shift_ids').notNull(), // JSON array matching dates

          // We need to find the index of this date in the booking's duration
          const dayDiff = Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

          if (dayDiff >= 0 && dayDiff < bookingShiftIds.length) {
            const bookedShiftId = bookingShiftIds[dayDiff];
            if (bookedShiftId === parseInt(shiftId as string)) {
              unavailableDates.add(dateStr);
            }
          }
        }
      }
    }

    const availability = dateArray.map((date: string) => ({
      date,
      available: !unavailableDates.has(date),
    }));

    res.json(availability);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get calendar availability (booked slots for a date range)
router.get('/vehicles/:vehicleId/calendar-availability', async (req, res) => {
  const { vehicleId } = req.params;
  const { start, end } = req.query;

  try {
    if (!start || !end) {
      return res.status(400).json({ error: 'Start and end dates are required' });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    // Get all active/pending bookings (any non-cancelled/expired status means date is taken)
    const existingBookings = await db.select()
      .from(bookings)
      .where(
        and(
          eq(bookings.vehicleId, parseInt(vehicleId as string)),
          inArray(bookings.status, ['pending_publisher_signature', 'pending_renter_signature', 'pending_payment', 'payment_sent', 'confirmed', 'active'])
        )
      );

    // Map date -> taken shift IDs
    const takenSlots: Record<string, number[]> = {};

    for (const booking of existingBookings) {
      const bookingShiftIds = booking.selectedShiftIds as number[];
      const bStart = new Date(booking.startDate);
      const bEnd = new Date(booking.endDate);

      // Check overlap with requested range
      if (bEnd < startDate || bStart > endDate) continue;

      // Iterate booking days
      const current = new Date(bStart);
      let dayIndex = 0;

      while (current <= bEnd) {
        if (current >= startDate && current <= endDate) {
          const dateStr = current.toISOString().split('T')[0];

          if (!takenSlots[dateStr]) {
            takenSlots[dateStr] = [];
          }

          if (dayIndex < bookingShiftIds.length) {
            const shiftId = bookingShiftIds[dayIndex];
            if (!takenSlots[dateStr].includes(shiftId)) {
              takenSlots[dateStr].push(shiftId);
            }
          }
        }
        current.setDate(current.getDate() + 1);
        dayIndex++;
      }
    }

    res.json(takenSlots);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
