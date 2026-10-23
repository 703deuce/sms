import { z } from "zod";
import { parseCampaignConfigPatch } from "./campaign-config";

export const duplicateBehaviorSchema = z.enum(["skip", "update", "add_to_list"]);
export type DuplicateBehavior = z.infer<typeof duplicateBehaviorSchema>;

export const campaignExtendedConfigSchema = z.object({
  ownerUserId: z.string().optional(),
  leadSource: z.string().max(200).optional(),
  duplicateBehavior: duplicateBehaviorSchema.optional(),
  contactOwnership: z.enum(["workspace", "assigned_rep"]).optional(),
  scriptId: z.string().nullable().optional(),
  voicemailDropId: z.string().nullable().optional(),
  recordingEnabled: z.boolean().optional(),
  screeningMode: z.string().optional(),
  dispositionSetId: z.string().nullable().optional(),
  liveAnswerDispositionSetId: z.string().nullable().optional(),
  noAnswerDispositionSetId: z.string().nullable().optional(),
  callbackRoutingMode: z
    .enum(["same_rep", "best_eligible", "group", "external", "ai_receptionist"])
    .optional(),
  callerIdRotationMode: z.enum(["sticky", "rotate", "local_presence"]).optional(),
  numberPoolDailyCap: z.number().int().min(1).max(10_000).optional(),
  requireExplicitConsent: z.boolean().optional(),
  callbackAction: z.string().optional(),
  leadRemovalDispositions: z.array(z.string()).optional(),
  dncDispositions: z.array(z.string()).optional(),
  memberUserIds: z.array(z.string()).optional(),
  leadOwnerRouting: z.enum(["off", "assigned_only", "allow_cross_rep"]).optional(),
  callbackRoutingE164: z.string().optional(),
  callerIdPhoneNumberId: z.string().nullable().optional(),
  callerIdPoolNumberIds: z.array(z.string()).optional(),
});

export type CampaignExtendedConfig = z.infer<typeof campaignExtendedConfigSchema>;

export function parseExtendedConfig(raw: unknown): CampaignExtendedConfig {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const slice = {
    ownerUserId: o.ownerUserId,
    leadSource: o.leadSource,
    duplicateBehavior: o.duplicateBehavior,
    contactOwnership: o.contactOwnership,
    scriptId: o.scriptId,
    voicemailDropId: o.voicemailDropId,
    recordingEnabled: o.recordingEnabled,
    screeningMode: o.screeningMode,
    dispositionSetId: o.dispositionSetId,
    liveAnswerDispositionSetId: o.liveAnswerDispositionSetId,
    noAnswerDispositionSetId: o.noAnswerDispositionSetId,
    callbackRoutingMode: o.callbackRoutingMode,
    callerIdRotationMode: o.callerIdRotationMode,
    numberPoolDailyCap: o.numberPoolDailyCap,
    requireExplicitConsent: o.requireExplicitConsent,
    callbackAction: o.callbackAction,
    leadRemovalDispositions: o.leadRemovalDispositions,
    dncDispositions: o.dncDispositions,
    memberUserIds: o.memberUserIds,
    leadOwnerRouting: o.leadOwnerRouting,
    callbackRoutingE164: o.callbackRoutingE164,
    callerIdPhoneNumberId: o.callerIdPhoneNumberId,
    callerIdPoolNumberIds: o.callerIdPoolNumberIds,
  };
  return campaignExtendedConfigSchema.parse(slice);
}

export function mergeCampaignConfigInput(body: Record<string, unknown>) {
  const rules = body.configJson && typeof body.configJson === "object"
    ? parseCampaignConfigPatch(body.configJson)
    : parseCampaignConfigPatch(body);
  const extended = parseExtendedConfig(body.configJson ?? body);
  return { rules, extended };
}
