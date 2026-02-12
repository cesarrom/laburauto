import { Router } from 'express';
import { db } from '../../db';
import { contractTemplates } from '@laburauto/shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Create new contract template
router.post('/', async (req, res) => {
  const { name, type, pdfUrl, fields, stages, variableSchema } = req.body;

  try {
    const [template] = await (db as any).insert(contractTemplates).values({
      name,
      type,
      pdfUrl,
      fields,
      stages,
      variableSchema,
    }).returning();

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Get all templates
router.get('/', async (req, res) => {
  try {
    const templates = await (db as any).select().from(contractTemplates)
      .orderBy(desc(contractTemplates.createdAt));

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Get template by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [template] = await (db as any).select().from(contractTemplates)
      .where(eq(contractTemplates.id, parseInt(id)))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// Get available variables for a template type
router.get('/:id/variables', async (req, res) => {
  const { id } = req.params;

  try {
    const [template] = await (db as any).select().from(contractTemplates)
      .where(eq(contractTemplates.id, parseInt(id)))
      .limit(1);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      templateType: template.type,
      variableSchema: template.variableSchema || {},
    });
  } catch (error) {
    console.error('Error fetching variables:', error);
    res.status(500).json({ error: 'Failed to fetch variables' });
  }
});

// Update template
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, pdfUrl, fields, stages, variableSchema } = req.body;

  try {
    const [updated] = await (db as any).update(contractTemplates)
      .set({
        name,
        pdfUrl,
        fields,
        stages,
        variableSchema,
      })
      .where(eq(contractTemplates.id, parseInt(id)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await (db as any).delete(contractTemplates)
      .where(eq(contractTemplates.id, parseInt(id)));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
