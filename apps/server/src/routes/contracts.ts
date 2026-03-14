import { Router } from 'express';
import { db } from '../db';
import { contractInstances, bookings, users } from '@laburauto/shared/schema';
import { getSignedUrl } from '../services/bytescale';
import { MagicLinkService } from '../services/magicLinkService';
import { eq } from 'drizzle-orm';
import { DocusealService } from '../services/docuseal';
import { resolveDocusealTemplateIdForContractType } from '../services/docusealTemplateService';
import { requireAuth } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { signContractSchema } from '@laburauto/shared/zod';

const router = Router();

const canAccessContractInstance = (instance: any, user: { id: number; role: string | null }) => {
  if (user.role === 'admin') return true;
  if (instance.publisherId === user.id) return true;
  if (instance.renterId === user.id) return true;
  return false;
};

const canResendInvitation = (instance: any, user: { id: number; role: string | null }) => {
  if (user.role === 'admin') return true;
  if (user.role === 'publisher' && instance.publisherId === user.id) return true;
  return false;
};

const normalizeStageRole = (role?: string | null) => {
  if (!role) return null;
  if (role === 'driver') return 'renter';
  return role;
};

const parseDocusealContractInstanceId = (payload: any): number | null => {
  // Try to find contractInstanceId in external_id, metadata, or custom fields
  const externalId = payload?.external_id || payload?.submission?.external_id || payload?.data?.external_id;
  if (externalId && !isNaN(parseInt(externalId))) {
    return parseInt(externalId);
  }

  // Check metadata if available
  const metadata = payload?.metadata || payload?.submission?.metadata || payload?.data?.metadata;
  if (metadata?.contractInstanceId) {
    return parseInt(metadata.contractInstanceId);
  }

  return null;
};

const parseDocusealCompletedRole = (payload: any): string | null => {
  // Submission response often contains the role of the person who just signed
  const submitterRole = payload?.submitter?.role || payload?.data?.submitter?.role;
  return normalizeStageRole(submitterRole);
};

const getDocusealSignUrlForRole = (instance: any, role: 'publisher' | 'renter') => {
  if (role === 'publisher') return instance.docusealPublisherSignUrl || null;
  return instance.docusealRenterSignUrl || null;
};

const getRoleFromUser = (user: { role: string | null }) => {
  if (user.role === 'publisher') return 'publisher';
  if (user.role === 'driver') return 'renter';
  return null;
};

export async function ensureDocusealSubmissionForInstance(instanceId: number, actorUserId: number | null = null) {
  if (!DocusealService.hasApiAccess()) {
    return null;
  }

  const instance = await db.query.contractInstances.findFirst({
    where: eq(contractInstances.id, instanceId),
  });

  if (!instance) {
    return null;
  }

  if (instance.docusealSubmissionId && (instance.docusealPublisherSignUrl || !instance.publisherId)) {
    const renterReady = !instance.renterId || !!instance.docusealRenterSignUrl;
    if (renterReady) {
      return instance;
    }
  }

  const { templateId, source } = await resolveDocusealTemplateIdForContractType(instance.contractType as any);
  if (!templateId) {
    return null;
  }

  const submitters: Array<{ email: string; role: 'publisher' | 'renter'; name?: string }> = [];

  if (instance.publisherId) {
    const publisher = await db.query.users.findFirst({ where: eq(users.id, instance.publisherId) });
    if (publisher) {
      submitters.push({ email: publisher.email, role: 'publisher', name: publisher.name || undefined });
    }
  }

  if (instance.renterId) {
    const renter = await db.query.users.findFirst({ where: eq(users.id, instance.renterId) });
    if (renter) {
      submitters.push({ email: renter.email, role: 'renter', name: renter.name || undefined });
    }
  }

  const submission = await DocusealService.createSubmission({
    templateId,
    contractInstanceId: instanceId,
    submitters,
  });

  const roleUrls = DocusealService.extractRoleUrlsFromSubmissionResponse(submission);

  const [updated] = await db.update(contractInstances)
    .set({
      docusealSubmissionId: submission?.id?.toString?.() || submission?.data?.id?.toString?.() || null,
      docusealPublisherSignUrl: roleUrls.publisher || null,
      docusealRenterSignUrl: roleUrls.renter || null,
      auditLog: [
        ...(instance.auditLog as any[]),
        {
          stage: 'docuseal-submission-created',
          userId: actorUserId,
          timestamp: new Date().toISOString(),
          action: 'docuseal_submission_created',
          submissionId: submission?.id || submission?.data?.id || null,
          roleUrls,
          templateSource: source,
        }
      ]
    })
    .where(eq(contractInstances.id, instanceId))
    .returning();

  return updated;
}

const resolveSigningInvitationUrl = async (
  instance: any,
  role: 'publisher' | 'renter',
  signerId: number,
  req: any
) => {
  let signUrl = getDocusealSignUrlForRole(instance, role);

  if (!signUrl) {
    const refreshed = await ensureDocusealSubmissionForInstance(instance.id, req.user?.id || null);
    if (refreshed) {
      signUrl = getDocusealSignUrlForRole(refreshed, role);
    }
  }

  if (signUrl) {
    return signUrl;
  }

  return MagicLinkService.createLink(
    signerId,
    `/portal/contracts/${instance.id}`,
    req
  );
};

/**
 * CONTRACT INSTANCES
 */

// Create instance for a booking or user enrollment
router.post('/instances', requireAuth, async (req, res) => {
  try {
    const { contractType, bookingId, userId, publisherId } = req.body;

    if (!contractType) {
      return res.status(400).json({ error: 'contractType is required' });
    }

    // Role check: if we are creating an enrollment contract, the user might not have a role yet
    const userRole = req.user?.role;
    const isEnrollment = contractType === 'publisher_enrollment';

    let finalPublisherId = publisherId;
    let finalRenterId = userId;
    let booking;

    if (bookingId) {
      booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
          vehicle: true
        }
      });

      if (booking) {
        if (userRole !== 'admin' && booking.vehicle.publisherId !== req.user!.id) {
          return res.status(403).json({ error: 'Only the booking publisher or admin can create this contract instance' });
        }
        finalPublisherId = booking.vehicle.publisherId;
        finalRenterId = booking.driverId;
      }
    } else if (isEnrollment) {
      // For enrollment, the actor must be the user being enrolled or an admin
      if (userRole !== 'admin' && userId !== req.user!.id) {
        return res.status(403).json({ error: 'Not authorized to create enrollment for another user' });
      }
      finalPublisherId = userId;
      finalRenterId = null;
    }

    // Create instance
    const [newInstance] = await db.insert(contractInstances).values({
      contractType,
      publisherId: finalPublisherId,
      renterId: finalRenterId,
      bookingId,
      status: 'pending',
      auditLog: [{
        stage: 'created',
        userId: req.user!.id,
        timestamp: new Date().toISOString(),
        action: 'created'
      }]
    }).returning();

    // Link to booking if provided
    if (bookingId) {
      await db.update(bookings)
        .set({ contractId: newInstance.id })
        .where(eq(bookings.id, bookingId));
    }

    // Link to user enrollment if provided
    if (userId && contractType === 'publisher_enrollment') {
      await db.update(users)
        .set({ enrollmentContractId: newInstance.id })
        .where(eq(users.id, userId));
    }

    await ensureDocusealSubmissionForInstance(newInstance.id, req.user!.id);

    res.status(201).json(newInstance);
  } catch (err) {
    console.error('Instance creation error:', err);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

// Get instance
router.get('/instances/:id', requireAuth, async (req, res) => {
  try {
    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, parseInt(req.params.id as string)),
    });

    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    if (!canAccessContractInstance(instance, req.user!)) {
      return res.status(403).json({ error: 'You do not have access to this contract instance' });
    }

    // Sign URLs for client access
    const response = {
      ...instance,
      finalPdfUrl: instance.finalPdfUrl ? getSignedUrl(instance.finalPdfUrl) : null,
      docusealSignUrl: (() => {
        const effectiveRole = getRoleFromUser(req.user!);
        if (!effectiveRole) return null;
        return getDocusealSignUrlForRole(instance, effectiveRole);
      })(),
    };

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch instance' });
  }
});

// Unified signing endpoint (called by Docuseal Webhook or directly if needed)
router.post('/instances/:id/sign', requireAuth, validateRequest({ body: signContractSchema }), async (req, res) => {
  try {
    const { finalPdfUrl, auditEvent } = req.body;
    const instanceId = parseInt(req.params.id as string);

    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, instanceId),
    });

    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    const updateData: any = {
      finalPdfUrl: finalPdfUrl || instance.finalPdfUrl,
      auditLog: [
        ...(instance.auditLog as any[]),
        auditEvent || {
          stage: 'signed',
          userId: req.user!.id,
          timestamp: new Date().toISOString(),
          action: 'signed'
        }
      ]
    };

    // If auditEvent says it's final or we decide it's signed
    if (auditEvent?.isFinal) {
      updateData.status = 'signed';
      updateData.signedAt = new Date();
    }

    const [updated] = await db.update(contractInstances)
      .set(updateData)
      .where(eq(contractInstances.id, instanceId))
      .returning();

    res.json(updated);
  } catch (err) {
    console.error('Sign error:', err);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

// Resend Invitation
router.post('/instances/:id/resend-invitation', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, parseInt(id as string)),
    });

    if (!instance) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (!canResendInvitation(instance, req.user!)) {
      return res.status(403).json({ error: 'Not authorized to resend invitations' });
    }

    // Determine who needs to sign next. Simple logic: if publisher hasn't signed (no url or something), send to them.
    // In pure Docuseal, we usually send both or sequential via Docuseal.
    // For now, let's just refresh the submission which sends invitations if configured in Docuseal.
    const updated = await ensureDocusealSubmissionForInstance(instance.id, req.user!.id);
    
    res.json({ success: !!updated });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// Docuseal webhook endpoint
router.post('/docuseal/webhook', async (req, res) => {
  try {
    const secretHeader = req.headers['x-docuseal-secret'];
    const providedSecret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;

    if (!DocusealService.verifyWebhookSecret(providedSecret)) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }

    const payload = req.body;
    const eventType = payload?.event || payload?.event_type || payload?.type || 'unknown';
    const instanceId = parseDocusealContractInstanceId(payload);

    if (!instanceId) {
      return res.status(202).json({ ignored: true, reason: 'No contract instance mapping found' });
    }

    const instance = await db.query.contractInstances.findFirst({ where: eq(contractInstances.id, instanceId) });
    if (!instance) {
      return res.status(404).json({ error: 'Contract instance not found' });
    }

    const completedRole = parseDocusealCompletedRole(payload);
    const updateData: any = {
      auditLog: [
        ...(instance.auditLog as any[]),
        {
          stage: `docuseal-webhook-${eventType}`,
          userId: null,
          timestamp: new Date().toISOString(),
          action: 'docuseal_webhook_received',
          eventType,
          completedRole,
        }
      ]
    };

    const isSubmissionCompleted =
      eventType.includes('submission.completed') ||
      eventType.includes('submission_finished') ||
      payload?.status === 'completed' ||
      payload?.submission?.status === 'completed';

    if (isSubmissionCompleted) {
      updateData.status = 'signed';
      updateData.signedAt = new Date();
    }

    await db.update(contractInstances)
      .set(updateData)
      .where(eq(contractInstances.id, instanceId));

    return res.json({ ok: true });
  } catch (err: any) {
    console.error('Docuseal webhook error:', err);
    return res.status(500).json({ error: 'Docuseal webhook processing failed', details: err?.message });
  }
});

export default router;
