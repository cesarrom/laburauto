import { Router } from 'express';
import { db } from '../db';
import { contractTemplates, contractInstances, bookings, users, notifications } from '../../db/schema';
import { EmailService } from '../services/emailService';
import { PdfService } from '../services/pdfService';
import { AuditService } from '../services/auditService';
import { uploadBuffer, getSignedUrl } from '../services/bytescale';
import { MagicLinkService } from '../services/magicLinkService';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { ContractVariableService, VariableContext } from '../services/contractVariableService';
import { DocusealService } from '../services/docuseal';
import { resolveDocusealTemplateIdForContractType } from '../services/docusealTemplateService';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { createTemplateSchema, signContractSchema } from '@laburauto/shared/zod';

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

const isSignerStage = (stage: any) => {
  const normalizedType = stage?.type === 'sign' ? 'signer' : stage?.type;
  return normalizedType === 'signer' || stage?.action === 'sign' || !!stage?.role;
};

const getEffectiveStageRole = (
  template: { type: 'publisher_enrollment' | 'rental_agreement' },
  stage: any,
  stageIndex: number
) => {
  const explicitRole = normalizeStageRole(stage?.role);
  if (explicitRole) return explicitRole;
  if (stageIndex === 0) return 'publisher';
  return template.type === 'rental_agreement' ? 'renter' : 'publisher';
};

const isStageCompleted = (instance: any, stageNumber: number) => {
  if (stageNumber === 2) return !!instance.stage2CompletedAt;
  if (stageNumber === 3) return !!instance.stage3CompletedAt;
  return false;
};

const validateTemplateWorkflow = (type: 'publisher_enrollment' | 'rental_agreement', stages: any[]) => {
  const signerStages = (stages || []).filter((s: any) => isSignerStage(s));

  if (type === 'publisher_enrollment') {
    if (signerStages.length !== 1) {
      return 'Publisher enrollment contracts must have exactly one signer stage.';
    }

    const role = normalizeStageRole(signerStages[0].role) || 'publisher';
    if (role !== 'publisher') {
      return 'Publisher enrollment signer stage must be assigned to publisher.';
    }
  }

  if (type === 'rental_agreement') {
    if (signerStages.length !== 2) {
      return 'Rental agreements must have exactly two signer stages (publisher then renter).';
    }

    const firstRole = normalizeStageRole(signerStages[0].role) || 'publisher';
    const secondRole = normalizeStageRole(signerStages[1].role) || 'renter';

    if (firstRole !== 'publisher' || secondRole !== 'renter') {
      return 'Rental agreement signer order must be publisher first and renter second.';
    }
  }

  return null;
};

const parseDocusealContractInstanceId = (payload: any): number | null => {
  const externalId =
    payload?.external_id ||
    payload?.submission?.external_id ||
    payload?.data?.external_id ||
    payload?.data?.submission?.external_id;

  if (typeof externalId === 'string') {
    const match = externalId.match(/contract-instance-(\d+)/);
    if (match) return parseInt(match[1]);
  }

  const directId = payload?.contractInstanceId || payload?.data?.contractInstanceId;
  if (typeof directId === 'number') return directId;
  if (typeof directId === 'string' && /^\d+$/.test(directId)) return parseInt(directId);

  return null;
};

const parseDocusealCompletedRole = (payload: any): 'publisher' | 'renter' | null => {
  const role = normalizeStageRole(
    payload?.role ||
    payload?.submitter?.role ||
    payload?.data?.submitter?.role ||
    payload?.data?.role
  );

  if (role === 'publisher' || role === 'renter') return role;
  return null;
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
    with: { template: true }
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

  const { templateId, source } = await resolveDocusealTemplateIdForContractType(instance.template.type as any);
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
 * Helper: Initialize a contract instance with Stage 1 auto-fulfillment
 * Stage 1 (prep/system) resolves variables and generates the initial PDF
 */
export async function initializeContractInstance(
  templateId: number,
  context: VariableContext,
  publisherId?: number,
  renterId?: number,
  bookingId?: number
) {
  // Fetch template
  const template = await db.query.contractTemplates.findFirst({
    where: eq(contractTemplates.id, templateId)
  });

  if (!template) throw new Error('Template not found');

  // Resolve variables in template fields
  const resolvedFields = ContractVariableService.processFields(template.fields, context);

  // Compile PDF with resolved variables (Stage 1 - System)
  const pdfBuffer = await PdfService.compilePdf(template.pdfUrl, resolvedFields);
  const stage1PdfUrl = await uploadBuffer(
    pdfBuffer,
    'application/pdf',
    `contract_${Date.now()}_stage1.pdf`,
    'contracts'
  );

  // Create instance with Stage 1 already completed
  const [instance] = await db.insert(contractInstances).values({
    templateId,
    publisherId,
    renterId,
    bookingId,
    status: 'pending',
    finalPdfUrl: stage1PdfUrl,
    variableValues: context,
    stage1CompletedAt: new Date(),
    stage1CompletedBy: null, // System completion
    auditLog: [{
      stage: 'stage-1-system',
      userId: null,
      timestamp: new Date().toISOString(),
      action: 'variables_resolved'
    }]
  }).returning();

  return instance;
}

/**
 * CONTRACT TEMPLATES (Admin only in real app)
 */

// List templates
router.get('/templates', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const templates = await db.select().from(contractTemplates);
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Update template (admin only)
router.put('/templates/:id', requireAuth, requireRole('admin'), validateRequest({ body: createTemplateSchema.partial() }), async (req, res) => {
  try {
    const templateId = parseInt(req.params.id as string);

    const existingTemplate = await db.query.contractTemplates.findFirst({
      where: eq(contractTemplates.id, templateId)
    });

    if (!existingTemplate) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const nextType = (req.body.type || existingTemplate.type) as 'publisher_enrollment' | 'rental_agreement';
    const nextStages = req.body.stages || existingTemplate.stages;
    const workflowError = validateTemplateWorkflow(nextType, nextStages);
    if (workflowError) {
      return res.status(400).json({ error: workflowError });
    }

    const [updated] = await db.update(contractTemplates)
      .set(req.body)
      .where(eq(contractTemplates.id, templateId))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Create template
router.post('/templates', requireAuth, requireRole('admin'), validateRequest({ body: createTemplateSchema }), async (req, res) => {
  try {
    const { name, type, pdfUrl, fields, stages, variableSchema } = req.body;

    const workflowError = validateTemplateWorkflow(type, stages);
    if (workflowError) {
      return res.status(400).json({ error: workflowError });
    }

    const [newTemplate] = await db.insert(contractTemplates).values({
      name,
      type,
      pdfUrl,
      fields,
      stages,
      variableSchema,
    }).returning();
    res.status(201).json(newTemplate);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * CONTRACT INSTANCES & SIGNING
 */

// Create instance for a booking or user enrollment
router.post('/instances', requireAuth, async (req, res) => {
  try {
    const { templateId, bookingId, userId, publisherId } = req.body;

    // Build variable context
    let context: VariableContext = { contractId: 0 }; // Will be set after creation
    let publisher, renter, booking;

    if (bookingId) {
      booking = await db.query.bookings.findFirst({
        where: eq(bookings.id, bookingId),
        with: {
          vehicle: { with: { vehicleModel: true } }
        }
      });

      if (booking) {
        if (req.user!.role !== 'admin' && booking.vehicle.publisherId !== req.user!.id) {
          return res.status(403).json({ error: 'Only the booking publisher or admin can create this contract instance' });
        }

        publisher = await db.query.users.findFirst({ where: eq(users.id, booking.vehicle.publisherId) });
        renter = await db.query.users.findFirst({ where: eq(users.id, booking.driverId) });

        context = {
          publisher: publisher ? { name: publisher.name || '', email: publisher.email } : undefined,
          renter: renter ? { name: renter.name || '', email: renter.email } : undefined,
          vehicle: {
            make: booking.vehicle.vehicleModel.brandName,
            model: booking.vehicle.vehicleModel.modelName,
            plate: booking.vehicle.plate
          },
          booking: { id: booking.id },
          contractId: 0
        };
      }
    } else if (publisherId || userId) {
      // Enrollment contract
      const targetUserId = publisherId || userId;
      if (req.user!.role !== 'admin' && req.user!.id !== targetUserId) {
        return res.status(403).json({ error: 'Not authorized to create enrollment contract for this user' });
      }
      publisher = await db.query.users.findFirst({ where: eq(users.id, targetUserId!) });

      if (publisher) {
        context = {
          publisher: { name: publisher.name || '', email: publisher.email },
          contractId: 0
        };
      }
    }

    // Initialize instance with Stage 1 auto-fulfilled
    const newInstance = await initializeContractInstance(
      templateId,
      context,
      publisherId || booking?.vehicle.publisherId,
      booking?.driverId,
      bookingId
    );

    // Link to booking if provided
    if (bookingId) {
      await db.update(bookings)
        .set({ contractId: newInstance.id })
        .where(eq(bookings.id, bookingId));
    }

    // Link to user enrollment if provided
    if (userId) {
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

// Get instance with template data for the SDK
router.get('/instances/:id', requireAuth, async (req, res) => {
  try {
    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, parseInt(req.params.id as string)),
      with: {
        template: true
      }
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
      template: {
        ...instance.template,
        pdfUrl: instance.template.pdfUrl.startsWith('http')
          ? instance.template.pdfUrl // External URL, use as-is
          : getSignedUrl(instance.template.pdfUrl) // Storage path, sign it
      }
    };

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch instance' });
  }
});

// Unified signing endpoint - template-driven, handles all contract types
const handleSignContract = async (req: any, res: any) => {
  try {
    const { finalPdfUrl, signedPdfUrl, auditEvent, fields } = req.body;
    const instanceId = parseInt(req.params.id as string);
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get instance with template and current user
    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, instanceId),
      with: { template: true }
    });

    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    if (!canAccessContractInstance(instance, req.user!)) {
      return res.status(403).json({ error: 'You are not a participant of this contract' });
    }

    // Ensure Stage 1 (system) is complete
    if (!instance.stage1CompletedAt) {
      return res.status(400).json({ error: 'Contract initialization incomplete' });
    }

    const template = instance.template;
    if (!template) return res.status(500).json({ error: 'Template not found' });

    // Find template stages (excluding system/prep stage)
    const humanStages = template.stages.filter((s: any) => isSignerStage(s));

    // Determine which DB stage this user should sign (stage2, stage3, etc.)
    let targetStageNumber: number | null = null;
    let targetTemplateStage: any = null;

    if (!userRole) {
      return res.status(403).json({ error: 'User role not found' });
    }

    // Map user role to template role
    const roleMap: Record<string, string> = {
      'publisher': 'publisher',
      'driver': 'renter',
      'admin': 'admin'
    };
    const mappedRole = roleMap[userRole];

    // Find the first incomplete stage that matches user's role
    for (let i = 0; i < humanStages.length; i++) {
      const stageNum = i + 2; // Stage 2, 3, 4, etc. (Stage 1 is system)
      const templateStage = humanStages[i];

      // Fallback: If role is missing in template, infer it:
      // First signer (Stage 2) -> publisher
      // Second signer (Stage 3) -> driver (if rental) or publisher (e.g. co-signer)
      const effectiveRole = getEffectiveStageRole(template as any, templateStage, i);

      // Check if this stage is already complete
      const isComplete = isStageCompleted(instance, stageNum);

      if (!isComplete && effectiveRole === mappedRole) {
        targetStageNumber = stageNum;
        targetTemplateStage = templateStage;
        break;
      }
    }

    // Verify user is authorized for this contract
    if (!targetStageNumber) {
      return res.status(403).json({ error: 'No pending signature stage for your role' });
    }

    // Validate sequential ordering (previous stages must be complete)
    if (targetStageNumber === 3 && !instance.stage2CompletedAt) {
      return res.status(400).json({ error: 'Previous stages must be completed first' });
    }
    // Future: Add more sequential checks for stage4+

    // Compile PDF (build on previous stage)
    let newFinalPdfUrl = finalPdfUrl || signedPdfUrl || instance.finalPdfUrl;
    let pdfBuffer: Buffer | undefined;

    if (fields) {
      const sourcePdfUrl = instance.finalPdfUrl || template.pdfUrl;
      pdfBuffer = await PdfService.compilePdf(sourcePdfUrl, fields);
      newFinalPdfUrl = await uploadBuffer(
        pdfBuffer,
        'application/pdf',
        `contract_${instanceId}_stage${targetStageNumber}.pdf`,
        'contracts'
      );
    }

    // Determine if this is the final stage
    const isFinalStage = targetStageNumber === humanStages.length + 1; // +1 because stage 1 is system

    // Update contract instance with appropriate stage completion
    const updateData: any = {
      finalPdfUrl: newFinalPdfUrl,
      auditLog: [
        ...(instance.auditLog as any[]),
        {
          stage: `stage-${targetStageNumber}-${userRole}`,
          userId,
          timestamp: new Date().toISOString(),
          action: 'signed'
        }
      ]
    };

    // Set stage-specific completion fields
    if (targetStageNumber === 2) {
      updateData.stage2CompletedAt = new Date();
      updateData.stage2CompletedBy = userId;
    } else if (targetStageNumber === 3) {
      updateData.stage3CompletedAt = new Date();
      updateData.stage3CompletedBy = userId;
    }
    // Future: Add stage4+

    // If final stage, mark contract as signed
    if (isFinalStage) {
      updateData.status = 'signed';
      updateData.signedAt = new Date();
    }

    const [updated] = await db.update(contractInstances)
      .set(updateData)
      .where(eq(contractInstances.id, instanceId))
      .returning();

    // Centralized Audit Log
    AuditService.log(
      userId,
      `contract.signed.stage${targetStageNumber}`,
      'contract_instance',
      instanceId,
      {
        stage: `stage-${targetStageNumber}-${userRole}`,
        isFinalStage,
        pdfHash: pdfBuffer ? crypto.createHash('sha256').update(pdfBuffer).digest('hex') : null
      },
      req
    );

    // Handle post-signing actions
    if (isFinalStage) {
      // Check if this is an enrollment contract
      const enrollmentUser = await db.query.users.findFirst({
        where: eq(users.enrollmentContractId, instanceId)
      });

      if (enrollmentUser) {
        // Complete onboarding for enrollment contracts
        await db.update(users)
          .set({ onboardingCompleted: true })
          .where(eq(users.id, enrollmentUser.id));
      }

      // Send final contract emails
      const admins = await db.query.users.findMany({ where: eq(users.role, 'admin') });

      // Determine recipients based on contract type
      if (template.type === 'publisher_enrollment') {
        const publisher = enrollmentUser || (instance.publisherId ?
          await db.query.users.findFirst({ where: eq(users.id, instance.publisherId) }) : null);

        if (publisher) {
          await EmailService.sendFinalContract({
            publisherEmail: publisher.email,
            adminEmails: admins.map(a => a.email),
            pdfUrl: newFinalPdfUrl || instance.finalPdfUrl,
            pdfBuffer: pdfBuffer,
            contractId: instanceId,
          });

          await db.update(contractInstances)
            .set({ emailSentAt: new Date() })
            .where(eq(contractInstances.id, instanceId));
        }
      } else {
        // Rental agreement - notify both parties
        const booking = await db.query.bookings.findFirst({
          where: eq(bookings.contractId, instanceId),
          with: { vehicle: true }
        });

        if (booking) {
          await db.update(bookings)
            .set({
              contractSignedAt: new Date(),
              contractFullySigned: true,
              status: 'pending_payment'  // Renter signed → ready for payment
            })
            .where(eq(bookings.id, booking.id));

          const publisher = await db.query.users.findFirst({ where: eq(users.id, booking.vehicle.publisherId) });
          const renter = await db.query.users.findFirst({ where: eq(users.id, booking.driverId) });

          if (publisher && renter) {
            await EmailService.sendFinalContract({
              publisherEmail: publisher.email,
              renterEmail: renter.email,
              adminEmails: admins.map(a => a.email),
              pdfUrl: newFinalPdfUrl || instance.finalPdfUrl,
              pdfBuffer: pdfBuffer,
              contractId: instanceId,
              bookingId: booking.id
            });

            await db.update(contractInstances)
              .set({ emailSentAt: new Date() })
              .where(eq(contractInstances.id, instanceId));

            // Notify both parties
            await (db).insert(notifications).values([
              {
                userId: publisher.id,
                type: 'contract_signed',
                message: `Rental agreement fully signed for booking #${booking.id}`,
                relatedEntityId: booking.id
              },
              {
                userId: renter.id,
                type: 'contract_signed',
                message: 'Contract signed! Please make the payment to confirm your booking.',
                relatedEntityId: booking.id
              }
            ]);
          }
        }
      }
    } else {
      // Not final stage - send invitation to next signer
      const nextStageNumber = targetStageNumber + 1;
      const nextStageIndex = nextStageNumber - 2; // Convert to 0-based index in humanStages

      if (nextStageIndex < humanStages.length) {
        const nextStage = humanStages[nextStageIndex];
        const nextRole = getEffectiveStageRole(template as any, nextStage, nextStageIndex);

        // Find user for next stage
        let nextSigner: any = null;
        if (nextRole === 'publisher' && instance.publisherId) {
          nextSigner = await db.query.users.findFirst({ where: eq(users.id, instance.publisherId) });
        }
        if (nextRole === 'renter' && instance.renterId) {
          nextSigner = await db.query.users.findFirst({ where: eq(users.id, instance.renterId) });
        }

        if (nextSigner) {
          const signingUrl = await resolveSigningInvitationUrl(instance, nextRole as 'publisher' | 'renter', nextSigner.id, req);

          await EmailService.sendSigningInvitation({
            email: nextSigner.email,
            magicLink: signingUrl,
            role: nextRole,
            contractId: instanceId,
            bookingId: instance.bookingId || undefined
          });

          await (db).insert(notifications).values({
            userId: nextSigner.id,
            type: 'contract_ready',
            message: nextRole === 'renter'
              ? 'Publisher signed the rental agreement. Please review and sign.'
              : 'A contract is ready for your signature.',
            relatedEntityId: instanceId
          });

          // Update booking status when transitioning to renter signature
          if (instance.bookingId && nextRole === 'renter') {
            await db.update(bookings)
              .set({ status: 'pending_renter_signature' })
              .where(eq(bookings.id, instance.bookingId));
          }
        }
      }
    }

    res.json({
      success: true,
      status: isFinalStage ? 'signed' : 'pending',
      nextStage: isFinalStage ? null : targetStageNumber + 1,
      instance: updated,
    });
  } catch (err) {
    console.error('Unified sign error:', err);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
};

router.post('/instances/:id/sign', requireAuth, validateRequest({ body: signContractSchema }), handleSignContract);

// Legacy alias kept for older tests/clients
router.post('/instances/:id/sign-stage-2', requireAuth, handleSignContract);

// Email Tracking Route
router.get('/instances/:id/track/:role', async (req, res) => {
  const { id, role } = req.params;
  const { email } = req.query;
  try {
    await db.update(contractInstances)
      .set({ emailOpenedAt: new Date() })
      .where(eq(contractInstances.id, parseInt(id as string)));

    const user = await db.query.users.findFirst({
      where: eq(users.email, email as string),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return a 1x1 transparent GIF
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });
    AuditService.log(
      user.id,
      'contract.email.opened',
      'contract_instance',
      parseInt(id as string),
      { role },
      req
    );
    res.end(pixel);
  } catch (err) {
    console.error('Tracking Error:', err);
    res.status(500).end();
  }
});

// Resend Invitation
router.post('/instances/:id/resend-invitation', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, parseInt(id as string)),
      with: { template: true },
    });

    if (!instance) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!canResendInvitation(instance, req.user)) {
      return res.status(403).json({ error: 'Not authorized to resend invitations for this contract' });
    }

    // Determine who needs to sign next from template workflow
    const humanStages = (instance.template?.stages || []).filter((s: any) => isSignerStage(s));
    let targetUser = null;
    let role = '';

    for (let i = 0; i < humanStages.length; i++) {
      const stageNumber = i + 2;
      if (isStageCompleted(instance, stageNumber)) {
        continue;
      }

      const resolvedRole = getEffectiveStageRole(instance.template as any, humanStages[i], i);

      if (resolvedRole === 'publisher' && instance.publisherId) {
        targetUser = await db.query.users.findFirst({ where: eq(users.id, instance.publisherId) });
        role = 'publisher';
      } else if (resolvedRole === 'renter' && instance.renterId) {
        targetUser = await db.query.users.findFirst({ where: eq(users.id, instance.renterId) });
        role = 'renter';
      }

      break;
    }

    if (!targetUser) {
      return res.status(400).json({ error: 'No pending signature required or signer not found' });
    }

    // Generate Magic Link
    const signingUrl = await resolveSigningInvitationUrl(instance, role as 'publisher' | 'renter', targetUser.id, req);

    // Send Email
    await EmailService.sendSigningInvitation({
      email: targetUser.email,
      magicLink: signingUrl,
      role,
      contractId: instance.id,
      // Find booking if exists
      bookingId: instance.bookingId || undefined
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error resending invitation:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

// Create Docuseal submission links for an instance (admin/publisher)
router.post('/instances/:id/docuseal-submission', requireAuth, async (req, res) => {
  try {
    if (!DocusealService.hasApiAccess()) {
      return res.status(400).json({ error: 'Docuseal API integration is not configured' });
    }

    const instanceId = parseInt(req.params.id as string);
    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, instanceId),
      with: { template: true }
    });

    if (!instance) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (!canAccessContractInstance(instance, req.user!)) {
      return res.status(403).json({ error: 'Not authorized to access this contract' });
    }

    if (req.user!.role !== 'admin' && req.user!.id !== instance.publisherId) {
      return res.status(403).json({ error: 'Only admin or publisher can create Docuseal submissions' });
    }

    const templateId = resolveDocusealTemplateId(instance.template.type as any);
    if (!templateId) {
      return res.status(400).json({ error: 'No Docuseal template configured for this contract type' });
    }

    const updated = await ensureDocusealSubmissionForInstance(instanceId, req.user!.id);

    if (!updated) {
      return res.status(500).json({ error: 'Failed to create Docuseal submission' });
    }

    return res.json({
      submissionId: updated.docusealSubmissionId,
      roleUrls: {
        publisher: updated.docusealPublisherSignUrl,
        renter: updated.docusealRenterSignUrl,
      },
    });
  } catch (err: any) {
    console.error('Docuseal submission error:', err);
    return res.status(500).json({ error: 'Failed to create Docuseal submission', details: err?.message });
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

    if (completedRole === 'publisher' && !instance.stage2CompletedAt) {
      updateData.stage2CompletedAt = new Date();
      updateData.stage2CompletedBy = instance.publisherId || null;
    }

    if (completedRole === 'renter' && !instance.stage3CompletedAt) {
      updateData.stage3CompletedAt = new Date();
      updateData.stage3CompletedBy = instance.renterId || null;
    }

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
