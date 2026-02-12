import { Router } from 'express';
import { db } from '../db';
import { notifications } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// Get notifications (polling)
// GET /api/notifications?userId=123&unread=true
router.get('/', async (req, res) => {
  const { userId, unread } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const filters = [eq(notifications.userId, parseInt(userId as string))];
    if (unread === 'true') {
      filters.push(eq(notifications.isRead, false));
    }

    const result = await db.select().from(notifications)
      .where(and(...filters))
      .orderBy(desc(notifications.createdAt));

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark as read
router.put('/:id/read', async (req, res) => {
  const { id } = req.params;
  try {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, parseInt(id as string)));
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
