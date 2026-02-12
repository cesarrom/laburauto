import { Router } from 'express';
import { db } from '../db';
import { vehicleModels } from '../../db/schema';
import { ilike, and, eq, sql } from 'drizzle-orm';

const router = Router();

// Search Brands
router.get('/brands', async (req, res) => {
  const query = (req.query.q as string || '').trim();

  try {
    // Get distinct brands matching query
    const results = await db
      .selectDistinct({ brand: vehicleModels.brandName })
      .from(vehicleModels)
      .where(ilike(vehicleModels.brandName, `%${query}%`))
      .orderBy(vehicleModels.brandName)
      .limit(50);

    res.json({ results: results.map(r => r.brand) });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
});

// Search Models (filtered by Brand)
router.get('/models', async (req, res) => {
  const brand = (req.query.brand as string || '').trim();
  const query = (req.query.q as string || '').trim();

  if (!brand) {
    return res.status(400).json({ error: 'Brand is required' });
  }

  try {
    const results = await db
      .selectDistinct({ model: vehicleModels.modelName })
      .from(vehicleModels)
      .where(
        and(
          eq(vehicleModels.brandName, brand), // Exact match for brand
          ilike(vehicleModels.modelName, `%${query}%`)
        )
      )
      .orderBy(vehicleModels.modelName)
      .limit(50);

    res.json({ results: results.map(r => r.model) });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// Search Versions (filtered by Brand and Model)
router.get('/versions', async (req, res) => {
  const brand = (req.query.brand as string || '').trim();
  const model = (req.query.model as string || '').trim();
  const query = (req.query.q as string || '').trim();

  if (!brand || !model) {
    return res.status(400).json({ error: 'Brand and Model are required' });
  }

  try {
    const results = await db
      .select({
        id: vehicleModels.id,
        version: vehicleModels.versionName,
        year: vehicleModels.typeName, // Note: Schema has typeName, using it for context if needed, but not strictly year.
      })
      .from(vehicleModels)
      .where(
        and(
          eq(vehicleModels.brandName, brand),
          eq(vehicleModels.modelName, model),
          ilike(vehicleModels.versionName, `%${query}%`)
        )
      )
      .orderBy(vehicleModels.versionName)
      .limit(50);

    res.json({ results });
  } catch (error) {
    console.error('Error fetching versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// Get specific vehicle model by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query.vehicleModels.findFirst({
      where: eq(vehicleModels.id, id) // UUID comparison
    });

    if (!result) return res.status(404).json({ error: 'Model not found' });
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
