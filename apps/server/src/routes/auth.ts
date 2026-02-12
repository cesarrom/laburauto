import { Router } from 'express';
import { db } from '../db';
import { users, contractTemplates, contractInstances } from '../../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuditService } from '../services/auditService';
import { MagicLinkService } from '../services/magicLinkService';
import { EmailService } from '../services/emailService';
import { validateRequest } from '../middleware/validate';
import { registerSchema, loginSchema, completeOnboardingSchema } from '@laburauto/shared/zod';
import { VariableContext } from '../services/contractVariableService';
import { uploadBuffer } from '../services/bytescale';
import { PdfService } from '../services/pdfService';
import { ContractVariableService } from '../services/contractVariableService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Register - now only requires name, email, password
router.post('/register', validateRequest({ body: registerSchema }), async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: null, // Will be set during onboarding
      onboardingCompleted: false,
    }).returning();

    const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        onboardingCompleted: newUser.onboardingCompleted
      }
    });

    // Audit Log
    AuditService.log(
      newUser.id,
      'auth.register',
      'user',
      newUser.id,
      { email: newUser.email },
      req
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', validateRequest({ body: loginSchema }), async (req, res) => {
  const { email, password } = req.body;

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted
      }
    });

    // Audit Log
    AuditService.log(
      user.id,
      'auth.login',
      'user',
      user.id,
      {},
      req
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Complete onboarding
router.post('/complete-onboarding', validateRequest({ body: completeOnboardingSchema }), async (req, res) => {
  const { userId, role, kycData } = req.body;

  try {


    // Ensure we use the name from the DB (source of truth)
    let parsedKycData;
    try {
      parsedKycData = JSON.parse(kycData);
    } catch (e) {
      // Should catch invalid JSON if zod didn't catch it structure-wise, but it's a string.
      parsedKycData = {};
    }

    // We already have the updatedUser (which might have the old name if we didn't update it, but we didn't update name here).
    // Actually, we should fetch the user first or just use the name we have if we trust it wasn't changed.
    // Better: update the kycData payload BEFORE the update query.

    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    parsedKycData.fullName = currentUser.name;
    const finalKycData = JSON.stringify(parsedKycData);

    let onboardingCompleted = true;
    let enrollmentContractId = null;

    if (role === 'publisher') {
      onboardingCompleted = false;

      // Find Template
      const template = await db.query.contractTemplates.findFirst({
        where: eq(contractTemplates.type, 'publisher_enrollment')
      });

      if (template) {
        let instance;

        // Check if user already has a pending enrollment contract
        if (currentUser.enrollmentContractId) {
          const existingInstance = await db.query.contractInstances.findFirst({
            where: eq(contractInstances.id, currentUser.enrollmentContractId)
          });

          // Reuse if pending
          if (existingInstance && existingInstance.status === 'pending') {
            instance = existingInstance;
            enrollmentContractId = instance.id;
          }
        }

        // Create new instance if none exists or previous was not pending
        if (!instance) {
          // Build variable context for enrollment
          const context: VariableContext = {
            publisher: { name: currentUser.name || '', email: currentUser.email },
            contractId: 0
          };

          //Resolve variables in template fields
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
          [instance] = await db.insert(contractInstances).values({
            templateId: template.id,
            publisherId: userId,
            status: 'pending',
            finalPdfUrl: stage1PdfUrl,
            variableValues: context as any,
            stage1CompletedAt: new Date(),
            stage1CompletedBy: null, // System completion
            auditLog: [{
              stage: 'stage-1-system',
              userId: null,
              timestamp: new Date().toISOString(),
              action: 'variables_resolved'
            }]
          }).returning();

          enrollmentContractId = instance.id;
        }

        // Create Magic Link for Signing
        const magicLink = await MagicLinkService.createLink(
          userId,
          `/portal/contracts/${instance.id}`,
          req
        );

        // Send Email
        await EmailService.sendSigningInvitation({
          email: currentUser.email,
          magicLink,
          role: 'publisher',
          contractId: instance.id
        });
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        role,
        kycData: finalKycData,
        onboardingCompleted,
        enrollmentContractId,
      })
      .where(eq(users.id, userId))
      .returning();

    const token = jwt.sign({ id: updatedUser.id, role: updatedUser.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        onboardingCompleted: updatedUser.onboardingCompleted
      }
    });

    AuditService.log(
      userId,
      'user.onboarding.complete',
      'user',
      userId,
      { role, hasKyc: !!kycData },
      req
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Magic Link Login
router.post('/magic-login', async (req, res) => {
  const { token } = req.body;

  try {
    const link = await MagicLinkService.verifyAndConsume(token, req);

    // Fetch user
    const [user] = await db.select().from(users).where(eq(users.id, link.userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate session token
    const sessionToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted
      },
      redirectPath: link.redirectPath
    });
  } catch (error: any) {
    console.error('Magic login error:', error);
    res.status(400).json({ error: error.message || 'Invalid magic link' });
  }
});

// Resend Enrollment Email
router.post('/resend-enrollment', validateRequest({}), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const [user] = await db.select().from(users).where(eq(users.id, decoded.id));

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'publisher') return res.status(400).json({ error: 'Only publishers can resend enrollment emails' });
    if (user.onboardingCompleted) return res.status(400).json({ error: 'Onboarding already completed' });
    if (!user.enrollmentContractId) return res.status(400).json({ error: 'No enrollment contract found' });

    // Validate contract status
    const contract = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, user.enrollmentContractId)
    });

    if (!contract || contract.status !== 'pending') {
      // Should we create a new one? For now assume valid state or user needs to contact support if void.
      // Or we could trigger the creation logic again. But simpler is safer.
      return res.status(400).json({ error: 'Contract is not in pending state' });
    }

    // Create Magic Link
    const magicLink = await MagicLinkService.createLink(
      user.id,
      `/portal/contracts/${contract.id}`,
      req
    );

    // Send Email
    await EmailService.sendSigningInvitation({
      email: user.email,
      magicLink,
      role: 'publisher',
      contractId: contract.id
    });

    res.json({ message: 'Email sent successfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to resend email' });
  }
});

// Get Current User
router.get('/me', validateRequest({}), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const [user] = await db.select().from(users).where(eq(users.id, decoded.id));

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
