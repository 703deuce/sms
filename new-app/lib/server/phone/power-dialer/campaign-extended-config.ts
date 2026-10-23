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
  callbackAction: z.string().optional(),
  leadRemovalDispositions: z.array(z.string()).optional(),
  dncDispositions: z.array(z.string()).optional(),
  memberUserIds: z.array(z.string()).optional(),
  callbackRoutingE164: z.string().optional(),
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
    callbackAction: o.callbackAction,
    leadRemovalDispositions: o.leadRemovalDispositions,
    dncDispositions: o.dncDispositions,
    memberUserIds: o.memberUserIds,
    callbackRoutingE164: o.callbackRoutingE164,
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
