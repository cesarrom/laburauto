import { Router } from 'express';
import { db } from '../db';
import { photoAudits, bookings, vehicles } from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { AuditService } from '../services/auditService';

const router = Router();

// Submit an audit (Check-in or Check-out)
router.post('/', async (req, res) => {
  try {
    const { bookingId, type, photos, odometerReading, metadata } = req.body;

    // 1. Basic Validation
    if (!['check_in', 'check_out'].includes(type)) {
      return res.status(400).json({ error: 'Invalid audit type' });
    }

    // 2. Metadata validation logic (EXIF "Now" & "Here")
    // In a real implementation, we would extract EXIF from photos 
    // or validate the signed metadata from the client.
    if (metadata && metadata.isLive === false) {
      return res.status(403).json({ error: 'Audit photos must be captured live, not from gallery.' });
    }

    // 3. Calculate SHA-256 hashes for each photo URL (for tamper detection)
    const photoHashes: string[] = [];
    for (const photoUrl of photos) {
      try {
        if (process.env.NODE_ENV === 'test') {
          const deterministicHash = crypto
            .createHash('sha256')
            .update(String(photoUrl))
            .digest('hex');
          photoHashes.push(deterministicHash);
          continue;
        }

        const response = await fetch(photoUrl, {
          signal: AbortSignal.timeout(1500),
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          const hash = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');
          photoHashes.push(hash);
        } else {
          photoHashes.push('fetch-failed');
        }
      } catch (err) {
        console.warn('Could not fetch photo for hashing:', err);
        photoHashes.push('error');
      }
    }

    // 4. Create Audit Record
    const [newAudit] = await db.insert(photoAudits).values({
      bookingId,
      type,
      photos,
      photoHashes,
      odometerReading,
      metadata
    }).returning();

    // 5. Update Vehicle Odometer
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        vehicle: true
      }
    });

    if (booking?.vehicleId) {
      await db.update(vehicles)
        .set({ lastOdometer: odometerReading })
        .where(eq(vehicles.id, booking.vehicleId));
    }

    // 6. If check_out, mark booking as completed (optional, or wait for publisher confirm)
    if (type === 'check_out') {
      await db.update(bookings)
        .set({ status: 'completed', returnedAt: new Date() })
        .where(eq(bookings.id, bookingId));
    }

    // 7. Audit log the photo submission
    AuditService.log(
      booking?.driverId || null,
      `booking.photo_audit.${type}`,
      'photo_audit',
      newAudit.id,
      { bookingId, odometerReading, photoCount: photos.length, photoHashes },
      req
    );

    res.status(201).json(newAudit);
  } catch (err) {
    console.error('Audit Error:', err);
    res.status(500).json({ error: 'Failed to submit audit' });
  }
});

// Get audits for a booking
router.get('/booking/:id', async (req, res) => {
  try {
    const audits = await db.select().from(photoAudits)
      .where(eq(photoAudits.bookingId, parseInt(req.params.id)));
    res.json(audits);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audits' });
  }
});

export default router;
