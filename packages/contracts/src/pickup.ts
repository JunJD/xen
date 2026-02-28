import { z } from 'zod';

export const translateProviderSchema = z.enum(['google', 'llm']);
export type TranslateProvider = z.infer<typeof translateProviderSchema>;

export const pickupParagraphSchema = z.object({
  id: z.string(),
  text: z.string(),
  hash: z.string().optional(),
});
export type PickupParagraph = z.infer<typeof pickupParagraphSchema>;

export const pickupTokenSchema = z.object({
  text: z.string(),
  tag: z.string(),
  typeId: z.number(),
  kind: z.enum(['grammar', 'vocabulary']).optional(),
  label: z.string().optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  tokenIndex: z.number().optional(),
  headIndex: z.number().optional(),
  pos: z.string().optional(),
  dep: z.string().optional(),
  spacyTag: z.string().optional(),
  sentence: z.number().optional(),
  isRoot: z.boolean().optional(),
  meaning: z.string().optional(),
});
export type PickupToken = z.infer<typeof pickupTokenSchema>;

export const pickupAnnotationSchema = z.object({
  id: z.string(),
  tokens: z.array(pickupTokenSchema),
});
export type PickupAnnotation = z.infer<typeof pickupAnnotationSchema>;

export const pickupTranslateUnitInputSchema = z.object({
  unitId: z.string(),
  text: z.string(),
  kind: z.enum(['grammar', 'vocabulary']).optional(),
  role: z.string().optional(),
  pos: z.string().optional(),
  dep: z.string().optional(),
  tokenIndex: z.number().optional(),
  span: z.tuple([z.number(), z.number()]).nullable().optional(),
});
export type PickupTranslateUnitInput = z.infer<typeof pickupTranslateUnitInputSchema>;

export const pickupTranslateParagraphInputSchema = z.object({
  id: z.string(),
  sourceText: z.string(),
  units: z.array(pickupTranslateUnitInputSchema),
});
export type PickupTranslateParagraphInput = z.infer<typeof pickupTranslateParagraphInputSchema>;

export const pickupTranslateUnitPreviewSchema = z.object({
  unitId: z.string(),
  vocabInfusionText: z.string(),
  vocabInfusionHint: z.string().optional(),
  usphone: z.string().optional(),
  ukphone: z.string().optional(),
  syntaxRebuildText: z.string(),
  context: pickupTranslateUnitInputSchema,
});
export type PickupTranslateUnitPreview = z.infer<typeof pickupTranslateUnitPreviewSchema>;

export const pickupTranslateParagraphPreviewSchema = z.object({
  id: z.string(),
  sourceText: z.string(),
  paragraphText: z.string(),
  units: z.array(pickupTranslateUnitPreviewSchema),
});
export type PickupTranslateParagraphPreview = z.infer<typeof pickupTranslateParagraphPreviewSchema>;

export const pickupModelRuntimeStatusSchema = z.enum(['idle', 'initializing', 'ready', 'error']);
export type PickupModelRuntimeStatus = z.infer<typeof pickupModelRuntimeStatusSchema>;

export const pickupModelStatusSchema = z.object({
  status: pickupModelRuntimeStatusSchema,
  error: z.string().nullable(),
  startedAt: z.number().nullable(),
  readyAt: z.number().nullable(),
  progress: z.number(),
  stage: z.string(),
});
export type PickupModelStatus = z.infer<typeof pickupModelStatusSchema>;

export const annotateRequestSchema = z.object({
  paragraphs: z.array(pickupParagraphSchema),
});
export const annotateResponseSchema = z.object({
  annotations: z.array(pickupAnnotationSchema),
});

export const translatePreviewRequestSchema = z.object({
  paragraphs: z.array(pickupTranslateParagraphInputSchema),
  provider: translateProviderSchema.optional(),
  includeParagraphTranslation: z.boolean().optional(),
});
export const translatePreviewResponseSchema = z.object({
  translations: z.array(pickupTranslateParagraphPreviewSchema),
});
