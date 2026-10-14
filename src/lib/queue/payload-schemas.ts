import { z } from "zod";

const uuid = z.string().uuid();
const optionalUuid = uuid.optional();
const optionalString = z.string().min(1).optional();

const processScanPayloadSchema = z
  .object({
    scanBatchId: uuid,
    organizationId: optionalUuid,
    businessId: optionalUuid,
    ledgerJobId: optionalString,
    jobType: z.string().optional(),
    recoveryGeneration: z.number().int().positive().optional(),
  })
  .passthrough();

const retryScanCellsPayloadSchema = z
  .object({
    scanBatchId: uuid,
    organizationId: optionalUuid,
    businessId: optionalUuid,
    ledgerJobId: optionalString,
    jobType: z.string().optional(),
    recoveryGeneration: z.number().int().positive().optional(),
  })
  .passthrough();

const importContactsPayloadSchema = z
  .object({
    uploadId: uuid,
    businessId: uuid,
    organizationId: uuid,
    mode: z.enum(["create", "update", "skip"]).optional(),
  })
  .passthrough();

const keywordCheckPayloadSchema = z
  .object({
    businessId: uuid,
    organizationId: uuid,
    keywordIds: z.array(uuid).optional(),
  })
  .passthrough();

const localTrustRunPayloadSchema = z
  .object({
    businessId: uuid,
    organizationId: uuid,
    city: z.string().optional(),
    state: z.string().optional(),
    county: z.string().optional(),
    rescan: z.boolean().optional(),
  })
  .passthrough();

const backlinkGapRunPayloadSchema = z
  .object({
    businessId: uuid,
    organizationId: uuid,
    scanBatchId: optionalUuid,
    competitorLimit: z.number().int().positive().optional(),
    selectedCompetitorIds: z.array(uuid).optional(),
    forceRefresh: z.boolean().optional(),
  })
  .passthrough();

const aiVisibilityRunPayloadSchema = z
  .object({
    businessId: uuid,
    organizationId: uuid,
    maxPrompts: z.number().int().positive().optional(),
    promptIds: z.array(uuid).optional(),
  })
  .passthrough();

const generateReportPayloadSchema = z
  .object({
    businessId: uuid,
    organizationId: optionalUuid,
    scanBatchId: optionalUuid,
    reportType: z.string().optional(),
    keywordId: optionalUuid,
    locationId: optionalUuid,
    campaignId: optionalUuid,
    gridSize: z.number().optional(),
    radiusMeters: z.number().optional(),
    selectedCompetitorKeys: z.array(z.string()).optional(),
    persist: z.boolean().optional(),
    reportId: optionalUuid,
    shareToken: z.string().optional(),
    identityKey: z.string().optional(),
    artifactKind: z.string().optional(),
    force: z.boolean().optional(),
    executiveSummary: z.string().nullable().optional(),
    sections: z.record(z.string(), z.boolean()).nullable().optional(),
    competitorLimit: z.union([z.literal("all"), z.literal(10), z.literal(20)]).optional(),
  })
  .passthrough();

const sendCampaignEmailPayloadSchema = z
  .object({
    messageId: uuid.optional(),
    relatedResourceId: uuid.optional(),
  })
  .passthrough()
  .refine((v) => Boolean(v.messageId ?? v.relatedResourceId), {
    message: "messageId or relatedResourceId required",
  });

const sendCampaignSmsPayloadSchema = sendCampaignEmailPayloadSchema;

const sendNotificationPayloadSchema = z
  .object({
    organizationId: uuid,
    toEmail: z.string().email().optional(),
    to: z.string().email().optional(),
    subject: z.string().min(1),
    textBody: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    businessId: optionalUuid,
  })
  .passthrough()
  .refine((v) => Boolean(v.toEmail ?? v.to), { message: "toEmail required" })
  .refine((v) => Boolean(v.textBody ?? v.body), { message: "textBody required" });

const growthAuditRunPayloadSchema = z
  .object({
    businessId: uuid,
    organizationId: uuid,
    keyword: z.string().optional(),
    skipBackground: z.boolean().optional(),
  })
  .passthrough();

export const JOB_PAYLOAD_SCHEMAS: Record<string, z.ZodTypeAny> = {
  process_scan: processScanPayloadSchema,
  retry_scan_cells: retryScanCellsPayloadSchema,
  import_contacts: importContactsPayloadSchema,
  keyword_check: keywordCheckPayloadSchema,
  local_trust_run: localTrustRunPayloadSchema,
  backlink_gap_run: backlinkGapRunPayloadSchema,
  ai_visibility_run: aiVisibilityRunPayloadSchema,
  generate_report: generateReportPayloadSchema,
  send_campaign_email: sendCampaignEmailPayloadSchema,
  send_campaign_sms: sendCampaignSmsPayloadSchema,
  send_notification: sendNotificationPayloadSchema,
  growth_audit_run: growthAuditRunPayloadSchema,
};

export function parseJobPayload(
  jobType: string,
  payload: unknown
): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  const schema = JOB_PAYLOAD_SCHEMAS[jobType];
  if (!schema) {
    return { ok: true, data: (payload ?? {}) as Record<string, unknown> };
  }
  const parsed = schema.safeParse(payload ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ") || "Invalid payload";
    return { ok: false, error: `Invalid ${jobType} payload: ${msg}` };
  }
  return { ok: true, data: parsed.data as Record<string, unknown> };
}
