import { Router } from 'express';
import { db } from '../db';
import { vehicles, users, photoAudits, bookings } from '@laburauto/shared/schema';
import { eq, desc } from 'drizzle-orm';
import templatesRouter from './admin/templates';
import docusealAdminRouter from './admin/docuseal';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// All admin routes require admin role
router.use(requireAuth, requireRole('admin'));

// Mount admin sub-routes
router.use('/templates', templatesRouter);
router.use('/docuseal', docusealAdminRouter);

// Admin: Evidence Kit (The "Botón de Demanda")
router.get('/evidence-kit/:bookingId', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    const data = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        driver: {
          with: {
            // Need to ensure relations are defined in schema.ts
          }
        },
        vehicle: true,
        photoAudits: true,
        contract: true,
      }
    });

    if (data?.contract) {
      console.log('DEBUG: EvidenceKit bookingId:', bookingId, 'contractId:', data.contract.id, 'status:', data.contract.status);
    } else {
      console.log('DEBUG: EvidenceKit bookingId:', bookingId, 'NO CONTRACT FOUND');
    }

    if (!data) return res.status(404).json({ error: 'Evidence kit data not found' });

    // Consolidate evidence kit
    const kit = {
      bundleVersion: "1.0",
      timestamp: new Date().toISOString(),
      legalIdentity: {
        renterName: data.driver.name,
        renterEmail: data.driver.email,
        verifiedKyc: data.driver.kycData, // Assuming JSON
      },
      contract: data.contract,
      auditHistory: data.photoAudits,
      state: data.status, // booking status
      contractStatus: data.contract?.status, // debug info
      contractId: data.contract?.id, // debug info
      payments: {
        proofUrl: data.paymentProofUrl,
        confirmedAt: data.paymentConfirmedAt
      }
    };

    res.json(kit);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate evidence kit' });
  }
});

// Admin: Update User Reputation Score
router.post('/users/:id/reputation', async (req, res) => {
  try {
    const { delta, reason } = req.body;
    const userId = parseInt(req.params.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const newScore = (user.reputationScore || 100) + delta;

    await db.update(users)
      .set({ reputationScore: newScore })
      .where(eq(users.id, userId));

    // Log the change (Notifications)
    // await db.insert(notifications).values({ ... });

    res.json({ success: true, newScore });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update reputation' });
  }
});

export default router;
