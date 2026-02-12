import { Router } from 'express';
import { db } from '../db';
import { renterDocuments } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { getSignedUrl } from '../services/bytescale';

const router = Router();

// Create or update renter documents
router.post('/', async (req, res) => {
  const { userId, uberRating, cabifyRating, indriveRating, didiRating, criminalBackground, dniPhoto } = req.body;

  try {
    // Validate at least one ride-share rating
    if (!uberRating && !cabifyRating && !indriveRating && !didiRating) {
      return res.status(400).json({ error: 'At least one ride-share rating is required' });
    }

    // Check if documents already exist for this user
    const existing = await db.select().from(renterDocuments).where(eq(renterDocuments.userId, userId));

    if (existing.length > 0) {
      // Update existing
      const [updated] = await db.update(renterDocuments)
        .set({
          uberRating,
          cabifyRating,
          indriveRating,
          didiRating,
          criminalBackground,
          dniPhoto,
          updatedAt: new Date(),
        })
        .where(eq(renterDocuments.userId, userId))
        .returning();

      return res.json(updated);
    } else {
      // Create new
      const [newDoc] = await db.insert(renterDocuments).values({
        userId,
        uberRating,
        cabifyRating,
        indriveRating,
        didiRating,
        criminalBackground,
        dniPhoto,
      }).returning();

      return res.status(201).json(newDoc);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get renter documents by userId (for publishers reviewing applications)
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const docs = await db.query.renterDocuments.findFirst({
      where: eq(renterDocuments.userId, parseInt(userId as string)),
    });

    if (!docs) {
      return res.status(404).json({ error: 'Renter documents not found' });
    }

    const signedDocs = {
      ...docs,
      uberRating: docs.uberRating ? getSignedUrl(docs.uberRating) : null,
      cabifyRating: docs.cabifyRating ? getSignedUrl(docs.cabifyRating) : null,
      indriveRating: docs.indriveRating ? getSignedUrl(docs.indriveRating) : null,
      didiRating: docs.didiRating ? getSignedUrl(docs.didiRating) : null,
      criminalBackground: docs.criminalBackground ? getSignedUrl(docs.criminalBackground) : null,
      dniPhoto: docs.dniPhoto ? getSignedUrl(docs.dniPhoto) : null,
    };

    res.json(signedDocs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
