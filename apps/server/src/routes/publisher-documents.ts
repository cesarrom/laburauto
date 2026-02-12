import { Router } from 'express';
import { db } from '../db';
import { publisherDocuments } from '@laburauto/shared';
import { eq } from 'drizzle-orm';

const router = Router();

// Submit publisher documents
router.post('/', async (req, res) => {
  const { publisherId, vehicleId, registrationCertificate, proofOfInsurance, technicalInspection } = req.body;

  try {
    const [doc] = await db.insert(publisherDocuments).values({
      publisherId,
      vehicleId: vehicleId || null,
      registrationCertificate,
      proofOfInsurance,
      technicalInspection,
    }).returning();

    res.status(201).json(doc);
  } catch (error) {
    console.error('Error saving publisher documents:', error);
    res.status(500).json({ error: 'Failed to save documents' });
  }
});

// Get publisher documents by publisher ID
router.get('/:publisherId', async (req, res) => {
  const { publisherId } = req.params;

  try {
    const docs = await db.query.publisherDocuments.findMany({
      where: eq(publisherDocuments.publisherId, parseInt(publisherId as string)),
    });

    res.json(docs);
  } catch (error) {
    console.error('Error fetching publisher documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

export default router;
