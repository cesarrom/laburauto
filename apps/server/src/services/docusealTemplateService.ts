import { db } from '../db';
import { docusealTemplates, docusealActiveTemplates, users } from '@laburauto/shared/schema';
import { asc, eq } from 'drizzle-orm';
import { DocusealService } from './docuseal';

type DocusealTemplateInsert = typeof docusealTemplates.$inferInsert;
type DocusealTemplateSelect = typeof docusealTemplates.$inferSelect;
type ContractType = 'publisher_enrollment' | 'rental_agreement';

type SyncResult = {
  total: number;
  matchesFilter: number;
};

const selectPreviewImage = (template: any): string | null => {
  if (template?.preview_image_url) return template.preview_image_url;
  if (Array.isArray(template?.documents)) {
    const docWithPreview = template.documents.find((doc: any) => doc?.preview_image_url);
    if (docWithPreview?.preview_image_url) {
      return docWithPreview.preview_image_url;
    }
  }
  return null;
};

const buildInsertPayload = (template: any, regex: RegExp | null, syncedAt: Date): DocusealTemplateInsert => {
  const matchesFilter = regex ? regex.test(template.name) : true;

  return {
    docusealTemplateId: String(template.id),
    name: template.name,
    slug: template.slug ?? null,
    externalId: template.external_id ?? null,
    folderName: template.folder_name ?? null,
    previewImageUrl: selectPreviewImage(template),
    sharedLink: typeof template.shared_link === 'boolean' ? template.shared_link : null,
    matchesFilter,
    stageCount: Array.isArray(template.schema) ? template.schema.length : null,
    fieldCount: Array.isArray(template.fields) ? template.fields.length : null,
    submitterCount: Array.isArray(template.submitters) ? template.submitters.length : null,
    docusealCreatedAt: template.created_at ? new Date(template.created_at) : null,
    docusealUpdatedAt: template.updated_at ? new Date(template.updated_at) : null,
    lastSyncedAt: syncedAt,
  };
};

export async function syncDocusealTemplates(): Promise<SyncResult> {
  console.log('[docusealTemplateService] syncDocusealTemplates started');
  if (!DocusealService.hasApiAccess()) {
    console.error('[docusealTemplateService] Docuseal API access NOT configured');
    throw new Error('Docuseal API access is not configured');
  }

  const templates = await DocusealService.listTemplates();
  console.log(`[docusealTemplateService] Fetched ${templates.length} templates from API`);
  
  const regex = DocusealService.getTemplateNameRegex();
  console.log(`[docusealTemplateService] Using name regex: ${regex}`);
  
  const syncedAt = new Date();
  let syncCount = 0;

  for (const template of templates) {
    const insertPayload = buildInsertPayload(template, regex, syncedAt);
    const { docusealTemplateId, ...updatePayload } = insertPayload;

    try {
      await db.insert(docusealTemplates)
        .values(insertPayload)
        .onConflictDoUpdate({
          target: docusealTemplates.docusealTemplateId,
          set: updatePayload,
        });
      syncCount++;
    } catch (err) {
      console.error(`[docusealTemplateService] Failed to sync template ${template.name} (ID: ${template.id}):`, err);
    }
  }

  const matchesFilter = regex
    ? templates.filter((template) => regex.test(template.name)).length
    : templates.length;

  console.log(`[docusealTemplateService] Sync finished. Total: ${templates.length}, Synced to DB: ${syncCount}, Matches filter: ${matchesFilter}`);

  return {
    total: templates.length,
    matchesFilter,
  };
}

type ActivationMetadata = {
  contractType: ContractType;
  activatedAt: Date | null;
  activatedById: number | null;
  activatedByName: string | null;
  activatedByEmail: string | null;
};

export type DocusealTemplateAdminView = DocusealTemplateSelect & {
  docusealUrl: string;
  isActivePublisherEnrollment: boolean;
  isActiveRentalAgreement: boolean;
  activations: Partial<Record<ContractType, ActivationMetadata>>;
};

export async function listDocusealTemplatesWithStatus(): Promise<DocusealTemplateAdminView[]> {
  const templates = await db.select().from(docusealTemplates).orderBy(asc(docusealTemplates.name));

  const activeRows = await db.select({
    contractType: docusealActiveTemplates.contractType,
    templateId: docusealActiveTemplates.templateId,
    docusealTemplateId: docusealActiveTemplates.docusealTemplateId,
    activatedAt: docusealActiveTemplates.activatedAt,
    activatedById: docusealActiveTemplates.activatedBy,
    activatedByName: users.name,
    activatedByEmail: users.email,
  })
    .from(docusealActiveTemplates)
    .leftJoin(users, eq(docusealActiveTemplates.activatedBy, users.id));

  const activationsByTemplateId: Record<number, Partial<Record<ContractType, ActivationMetadata>>> = {};
  for (const row of activeRows) {
    if (row.templateId == null) continue;
    const bucket = activationsByTemplateId[row.templateId] || {};
    bucket[row.contractType as ContractType] = {
      contractType: row.contractType as ContractType,
      activatedAt: row.activatedAt || null,
      activatedById: row.activatedById || null,
      activatedByName: row.activatedByName || null,
      activatedByEmail: row.activatedByEmail || null,
    };
    activationsByTemplateId[row.templateId] = bucket;
  }

  return templates.map((template) => {
    const activations = activationsByTemplateId[template.id] || {};
    return {
      ...template,
      docusealUrl: DocusealService.buildTemplateUrl(template.docusealTemplateId),
      isActivePublisherEnrollment: !!activations.publisher_enrollment,
      isActiveRentalAgreement: !!activations.rental_agreement,
      activations,
    };
  });
}

export async function setActiveDocusealTemplate(
  contractType: ContractType,
  templateId: number,
  activatedByUserId: number
) {
  const template = await db.query.docusealTemplates.findFirst({
    where: eq(docusealTemplates.id, templateId),
  });

  if (!template) {
    throw new Error('Docuseal template not found');
  }

  const now = new Date();

  await db.insert(docusealActiveTemplates)
    .values({
      contractType,
      templateId: template.id,
      docusealTemplateId: template.docusealTemplateId,
      docusealTemplateName: template.name,
      activatedBy: activatedByUserId,
      activatedAt: now,
    })
    .onConflictDoUpdate({
      target: docusealActiveTemplates.contractType,
      set: {
        templateId: template.id,
        docusealTemplateId: template.docusealTemplateId,
        docusealTemplateName: template.name,
        activatedBy: activatedByUserId,
        activatedAt: now,
      },
    });

  return getActiveTemplateRecord(contractType);
}

export async function getActiveTemplateRecord(contractType: ContractType) {
  return db.query.docusealActiveTemplates.findFirst({
    where: (fields, { eq }) => eq(fields.contractType, contractType),
  });
}

export async function resolveDocusealTemplateIdForContractType(contractType: ContractType) {
  const active = await getActiveTemplateRecord(contractType);
  if (active?.docusealTemplateId) {
    return { templateId: active.docusealTemplateId, source: 'db' as const };
  }

  const fallbackEnv = contractType === 'publisher_enrollment'
    ? process.env.DOCUSEAL_TEMPLATE_PUBLISHER_ENROLLMENT_ID
    : process.env.DOCUSEAL_TEMPLATE_RENTAL_AGREEMENT_ID;

  if (fallbackEnv) {
    return { templateId: fallbackEnv, source: 'env' as const };
  }

  return { templateId: null, source: null };
}
