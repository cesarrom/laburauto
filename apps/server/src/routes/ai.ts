import { Router } from 'express';
import { inferVehicleFromImage } from '../services/openrouter';

const router = Router();

// Infer vehicle information from image URL
router.post('/infer-vehicle', async (req, res) => {
  try {
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const result = await inferVehicleFromImage(imageUrl);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('AI inference error:', error);
    res.status(500).json({
      error: 'Failed to infer vehicle information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
