import { Router } from 'express';
import { z } from 'zod';
import {
  listDocusealTemplatesWithStatus,
  setActiveDocusealTemplate,
  syncDocusealTemplates,
} from '../../services/docusealTemplateService';

const router = Router();

router.post('/sync', async (_req, res) => {
  try {
    const stats = await syncDocusealTemplates();
    res.json({
      ok: true,
      synced: stats.total,
      matchesFilter: stats.matchesFilter,
    });
  } catch (error: any) {
    console.error('Docuseal sync failed:', error);
    res.status(500).json({ error: 'Failed to sync Docuseal templates', details: error?.message });
  }
});

router.get('/templates', async (_req, res) => {
  try {
    const templates = await listDocusealTemplatesWithStatus();
    res.json(templates);
  } catch (error: any) {
    console.error('Docuseal template list failed:', error);
    res.status(500).json({ error: 'Failed to load Docuseal templates', details: error?.message });
  }
});

const activateSchema = z.object({
  contractType: z.enum(['publisher_enrollment', 'rental_agreement']),
});

router.post('/templates/:id/activate', async (req, res) => {
  try {
    const templateId = parseInt(req.params.id, 10);
    if (Number.isNaN(templateId)) {
      return res.status(400).json({ error: 'Invalid template id' });
    }

    const { contractType } = activateSchema.parse(req.body);
    const record = await setActiveDocusealTemplate(contractType, templateId, req.user!.id);
    res.json({ ok: true, contractType, record });
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid request', details: error.flatten() });
    }

    console.error('Docuseal activation failed:', error);
    res.status(500).json({ error: 'Failed to activate template', details: error?.message });
  }
});

export default router;
