import { z } from 'zod';

// Field Types
export const FieldTypeSchema = z.enum(['variable', 'input', 'signature']);
export type FieldType = z.infer<typeof FieldTypeSchema>;

// Stage Schema
export const StageSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['prep', 'signer']),
  role: z.enum(['system', 'publisher', 'driver', 'admin']).optional(),
});
export type Stage = z.infer<typeof StageSchema>;

// Field Schema
export const FieldSchema = z.object({
  id: z.string(),
  type: FieldTypeSchema,
  stageId: z.string(),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  page: z.number(),
  value: z.string(),
  isSigned: z.boolean(),
  signatureData: z.string().nullable(),
});
export type Field = z.infer<typeof FieldSchema>;

// SDK Result Schema
// Note: pdfFile is Uint8Array, which is not directly JSON-serializable without conversion,
// but for Zod validation in memory it works.
export const SDKResultSchema = z.object({
  id: z.string(),
  fields: z.array(FieldSchema),
  stages: z.array(StageSchema),
  timestamp: z.string(),
  pdfFile: z.instanceof(Uint8Array),
});
export type SDKResult = z.infer<typeof SDKResultSchema>;

// Initial Data Schema
export const SignerInitialDataSchema = z.object({
  id: z.string().optional(),
  pdfFile: z.instanceof(Uint8Array),
  fields: z.array(FieldSchema).optional(),
  stages: z.array(StageSchema).optional(),
});
export type SignerInitialData = z.infer<typeof SignerInitialDataSchema>;
