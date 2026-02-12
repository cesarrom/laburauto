import { Router } from 'express';
import { db } from '../db';
import { contractTemplates, contractInstances, bookings, users, notifications } from '../../db/schema';
import { EmailService } from '../services/emailService';
import { PdfService } from '../services/pdfService';
import { AuditService } from '../services/auditService';
import { uploadBuffer, getSignedUrl } from '../services/bytescale';
import { MagicLinkService } from '../services/magicLinkService';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { ContractVariableService, VariableContext } from '../services/contractVariableService';
import { requireAuth, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { createTemplateSchema, signContractSchema } from '@laburauto/shared/zod';

const router = Router();

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
router.get('/templates', async (req, res) => {
  try {
    const templates = await db.select().from(contractTemplates);
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create template
router.post('/templates', requireAuth, requireRole('admin'), validateRequest({ body: createTemplateSchema }), async (req, res) => {
  try {
    const { name, type, pdfUrl, fields, stages, variableSchema } = req.body;
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

    res.status(201).json(newInstance);
  } catch (err) {
    console.error('Instance creation error:', err);
    res.status(500).json({ error: 'Failed to create instance' });
  }
});

// Get instance with template data for the SDK
router.get('/instances/:id', async (req, res) => {
  try {
    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, parseInt(req.params.id as string)),
      with: {
        template: true
      }
    });

    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    // Sign URLs for client access
    const response = {
      ...instance,
      finalPdfUrl: instance.finalPdfUrl ? getSignedUrl(instance.finalPdfUrl) : null,
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
router.post('/instances/:id/sign', requireAuth, validateRequest({ body: signContractSchema }), async (req, res) => {
  try {
    const { finalPdfUrl, auditEvent, fields } = req.body;
    const instanceId = parseInt(req.params.id as string);
    const userId = req.user!.id;
    const userRole = req.user!.role;

    // Get instance with template and current user
    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, instanceId),
      with: { template: true }
    });

    if (!instance) return res.status(404).json({ error: 'Instance not found' });

    // Ensure Stage 1 (system) is complete
    if (!instance.stage1CompletedAt) {
      return res.status(400).json({ error: 'Contract initialization incomplete' });
    }

    const template = instance.template;
    if (!template) return res.status(500).json({ error: 'Template not found' });

    // Find template stages (excluding system/prep stage)
    const humanStages = template.stages.filter((s: any) => s.type === 'signer');

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
      const effectiveRole = templateStage.role || (i === 0 ? 'publisher' : (template.type === 'rental_agreement' ? 'driver' : 'publisher'));

      // Check if this stage is already complete
      const isComplete = stageNum === 2 ? instance.stage2CompletedAt :
        stageNum === 3 ? instance.stage3CompletedAt :
          false; // Future: extend for stage4+

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
    let newFinalPdfUrl = finalPdfUrl || instance.finalPdfUrl;
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

        // Find user for next stage
        if (nextStage.role === 'driver' && instance.renterId) {
          const renter = await db.query.users.findFirst({ where: eq(users.id, instance.renterId) });
          if (renter) {
            const magicLink = await MagicLinkService.createLink(
              renter.id,
              `/portal/contracts/${instanceId}`,
              req
            );

            await EmailService.sendSigningInvitation({
              email: renter.email,
              magicLink,
              role: 'renter',
              contractId: instanceId,
              bookingId: instance.bookingId || undefined
            });

            await (db).insert(notifications).values({
              userId: renter.id,
              type: 'contract_ready',
              message: `Publisher signed the rental agreement. Please review and sign.`,
              relatedEntityId: instanceId
            });

            // Update booking status: Publisher signed → waiting for Renter
            if (instance.bookingId) {
              await db.update(bookings)
                .set({ status: 'pending_renter_signature' })
                .where(eq(bookings.id, instance.bookingId));
            }
          }
        }
      }
    }

    res.json({
      success: true,
      status: isFinalStage ? 'signed' : 'pending',
      nextStage: isFinalStage ? null : targetStageNumber + 1
    });
  } catch (err) {
    console.error('Unified sign error:', err);
    res.status(500).json({ error: 'Failed to sign contract' });
  }
});

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
router.post('/instances/:id/resend-invitation', async (req, res) => {
  const { id } = req.params;
  try {
    const instance = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, parseInt(id as string)),
      with: { template: true },
    });

    if (!instance) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    // Determine who needs to sign next
    let targetUser = null;
    let role = '';

    if (!instance.stage1CompletedAt) {
      targetUser = await db.query.users.findFirst({ where: eq(users.id, instance.publisherId!) });
      role = 'publisher';
    } else if (!instance.stage2CompletedAt) {
      targetUser = await db.query.users.findFirst({ where: eq(users.id, instance.renterId!) });
      role = 'renter';
    }

    if (!targetUser) {
      return res.status(400).json({ error: 'No pending signature required or signer not found' });
    }

    // Generate Magic Link
    const magicLink = await MagicLinkService.createLink(
      targetUser.id,
      `/portal/contracts/${id}`,
      req
    );

    // Send Email
    await EmailService.sendSigningInvitation({
      email: targetUser.email,
      magicLink,
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

export default router;
