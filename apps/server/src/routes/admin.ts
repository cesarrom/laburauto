import { Router } from 'express';
import { db } from '../db';
import { vehicles, users, photoAudits, bookings, contractInstances } from '@laburauto/shared/schema';
import { eq, desc } from 'drizzle-orm';
import docusealAdminRouter from './admin/docuseal';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// All admin routes require admin role
router.use(requireAuth, requireRole('admin'));

// Mount admin sub-routes
router.use('/docuseal', docusealAdminRouter);

// Admin: Evidence Kit (The "Botón de Demanda")
router.get('/evidence-kit/:bookingId', async (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    const data = await db.query.bookings.findFirst({
      where: eq(bookings.id, bookingId),
      with: {
        driver: true,
        vehicle: true,
        photoAudits: true,
        contract: true,
      }
    });

    if (!data) return res.status(404).json({ error: 'Evidence kit data not found' });

    // Consolidate evidence kit
    const kit = {
      bundleVersion: "1.1",
      timestamp: new Date().toISOString(),
      legalIdentity: {
        renterName: data.driver.name,
        renterEmail: data.driver.email,
        verifiedKyc: data.driver.kycData,
      },
      contract: data.contract ? {
        id: data.contract.id,
        status: data.contract.status,
        type: data.contract.contractType,
        signedAt: data.contract.signedAt,
        docusealSubmissionId: data.contract.docusealSubmissionId,
        pdfUrl: data.contract.finalPdfUrl ? getSignedUrl(data.contract.finalPdfUrl) : null,
      } : null,
      auditHistory: data.photoAudits,
      state: data.status,
      payments: {
        proofUrl: data.paymentProofUrl ? getSignedUrl(data.paymentProofUrl) : null,
        confirmedAt: data.paymentConfirmedAt
      }
    };

    res.json(kit);
  } catch (err) {
    console.error('Evidence kit error:', err);
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
