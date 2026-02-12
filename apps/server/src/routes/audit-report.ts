import { Router } from 'express';
import { db } from '../db';
import {
  auditLogs,
  bookings,
  contractInstances,
  photoAudits,
  users,
  vehicles,
  notifications
} from '@laburauto/shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getSignedUrl } from '../services/bytescale';

const router = Router();

/**
 * AUDIT REPORT API
 * 
 * These endpoints are designed for legal compliance and court proceedings.
 * They provide comprehensive, chronological audit trails with:
 * - All relevant actions and their metadata (IP, User-Agent, timestamp)
 * - Document hashes for tamper detection
 * - Signed URLs for evidence retrieval
 */

// Get complete audit timeline for a booking
// Designed for court proceedings - provides an impartial chronological record
router.get('/booking/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch the booking with all related data
    const booking = await db.query.bookings.findFirst({
      where: eq(bookings.id, parseInt(id as string)),
      with: {
        vehicle: {
          with: {
            publisher: true,
            vehicleModel: true,
          }
        },
        driver: true,
        contract: {
          with: {
            template: true
          }
        },
        photoAudits: true,
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // 2. Fetch all audit logs related to this booking
    const bookingAuditLogs = await db.select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, 'booking'),
          eq(auditLogs.entityId, parseInt(id as string))
        )
      )
      .orderBy(desc(auditLogs.createdAt));

    // 3. Fetch contract audit logs if contract exists
    let contractAuditLogs: typeof bookingAuditLogs = [];
    if (booking.contractId) {
      contractAuditLogs = await db.select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, 'contract_instance'),
            eq(auditLogs.entityId, booking.contractId)
          )
        )
        .orderBy(desc(auditLogs.createdAt));
    }

    // 4. Fetch photo audit logs
    const photoAuditIds = booking.photoAudits?.map(pa => pa.id) || [];
    let photoAuditLogs: typeof bookingAuditLogs = [];
    for (const paId of photoAuditIds) {
      const logs = await db.select()
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.entityType, 'photo_audit'),
            eq(auditLogs.entityId, paId)
          )
        );
      photoAuditLogs = [...photoAuditLogs, ...logs];
    }

    // 5. Fetch notifications sent for this booking (as proof of communication)
    const bookingNotifications = await db.select()
      .from(notifications)
      .where(eq(notifications.relatedEntityId, parseInt(id as string)))
      .orderBy(desc(notifications.createdAt));

    // 6. Combine and sort all timeline events chronologically
    const timeline = [
      ...bookingAuditLogs.map(log => ({
        source: 'booking',
        action: log.action,
        timestamp: log.createdAt,
        userId: log.userId,
        metadata: log.metadata,
        details: log.details,
      })),
      ...contractAuditLogs.map(log => ({
        source: 'contract',
        action: log.action,
        timestamp: log.createdAt,
        userId: log.userId,
        metadata: log.metadata,
        details: log.details,
      })),
      ...photoAuditLogs.map(log => ({
        source: 'photo_audit',
        action: log.action,
        timestamp: log.createdAt,
        userId: log.userId,
        metadata: log.metadata,
        details: log.details,
      })),
      ...bookingNotifications.map(notif => ({
        source: 'notification',
        action: `notification.${notif.type}`,
        timestamp: notif.createdAt,
        userId: notif.userId,
        metadata: null,
        details: { message: notif.message, isRead: notif.isRead },
      })),
    ].sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB; // Ascending chronological order
    });

    // 7. Build documents object with signed URLs and hashes
    const documents: any = {};

    // Payment proof
    if (booking.paymentProofUrl) {
      documents.paymentProof = {
        rawUrl: booking.paymentProofUrl,
        signedUrl: getSignedUrl(booking.paymentProofUrl, 3600), // 1 hour
        hash: booking.paymentProofHash || null,
      };
    }

    // Contract PDF
    if (booking.contract?.finalPdfUrl) {
      // Find the latest contract signing log to get the hash
      const contractSignLog = contractAuditLogs.find(
        log => log.action.includes('contract.signed') && (log.details as any)?.pdfHash
      );
      documents.contract = {
        rawUrl: booking.contract.finalPdfUrl,
        signedUrl: getSignedUrl(booking.contract.finalPdfUrl, 3600),
        hash: (contractSignLog?.details as any)?.pdfHash || null,
        status: booking.contract.status,
        signedAt: booking.contract.signedAt,
        stage1CompletedAt: booking.contract.stage1CompletedAt,
        stage1CompletedBy: booking.contract.stage1CompletedBy,
        stage2CompletedAt: booking.contract.stage2CompletedAt,
        stage2CompletedBy: booking.contract.stage2CompletedBy,
      };
    }

    // Return photo
    if (booking.returnPhotoUrl) {
      documents.returnPhoto = {
        rawUrl: booking.returnPhotoUrl,
        signedUrl: getSignedUrl(booking.returnPhotoUrl, 3600),
      };
    }

    // Photo audits (check-in/check-out)
    if (booking.photoAudits && booking.photoAudits.length > 0) {
      documents.photoAudits = booking.photoAudits.map(pa => ({
        id: pa.id,
        type: pa.type,
        odometerReading: pa.odometerReading,
        createdAt: pa.createdAt,
        photos: (pa.photos as string[]).map((photoUrl, idx) => ({
          rawUrl: photoUrl,
          signedUrl: getSignedUrl(photoUrl, 3600),
          hash: (pa.photoHashes as string[])?.[idx] || null,
        })),
      }));
    }

    // 8. Build email tracking info
    const emails: any[] = [];
    if (booking.contract) {
      if (booking.contract.emailSentAt) {
        emails.push({
          type: 'final_contract',
          sentAt: booking.contract.emailSentAt,
          openedAt: booking.contract.emailOpenedAt,
          wasOpened: !!booking.contract.emailOpenedAt,
        });
      }
    }

    // 9. Build parties info
    const parties = {
      renter: {
        id: booking.driver?.id,
        name: booking.driver?.name,
        email: booking.driver?.email,
      },
      publisher: {
        id: booking.vehicle?.publisher?.id,
        name: booking.vehicle?.publisher?.name,
        email: booking.vehicle?.publisher?.email,
      },
    };

    // 10. Build vehicle info
    const vehicleInfo = {
      id: booking.vehicle?.id,
      plate: booking.vehicle?.plate,
      make: booking.vehicle?.vehicleModel?.brandName,
      model: booking.vehicle?.vehicleModel?.modelName,
      year: booking.vehicle?.year,
    };

    // 11. Return complete audit report
    res.json({
      reportGeneratedAt: new Date().toISOString(),
      booking: {
        id: booking.id,
        status: booking.status,
        startDate: booking.startDate,
        endDate: booking.endDate,
        totalPrice: booking.totalPrice,
        createdAt: booking.createdAt,
        // Payment info
        paymentDeadline: booking.paymentDeadline,
        paymentConfirmedAt: booking.paymentConfirmedAt,
        // Dispute info
        disputeStatus: booking.disputeStatus,
        disputeNotes: booking.disputeNotes,
        // Lifecycle timestamps
        arrivedAt: booking.arrivedAt,
        rentalStartedAt: booking.rentalStartedAt,
        returnedAt: booking.returnedAt,
        returnConfirmedAt: booking.returnConfirmedAt,
        // Cancellation info
        cancelledAt: booking.cancelledAt,
        cancelledBy: booking.cancelledBy,
        cancellationReason: booking.cancellationReason,
        refundStatus: booking.refundStatus,
        // Contract status
        contractFullySigned: booking.contractFullySigned,
        contractSignedAt: booking.contractSignedAt,
      },
      parties,
      vehicle: vehicleInfo,
      timeline,
      documents,
      emails,
      summary: {
        totalAuditEntries: timeline.length,
        documentCount: Object.keys(documents).length,
        emailCount: emails.length,
      }
    });
  } catch (error) {
    console.error('Error generating audit report:', error);
    res.status(500).json({ error: 'Failed to generate audit report' });
  }
});

// Get raw audit logs for an entity (for debugging/admin)
router.get('/logs/:entityType/:entityId', async (req, res) => {
  const { entityType, entityId } = req.params;

  try {
    const logs = await db.select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, parseInt(entityId))
        )
      )
      .orderBy(desc(auditLogs.createdAt));

    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get all audit events for a user (useful for identity verification)
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const logs = await db.select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, parseInt(userId as string)))
      .orderBy(desc(auditLogs.createdAt));

    res.json(logs);
  } catch (error) {
    console.error('Error fetching user audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
