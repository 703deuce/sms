import { getPrisma } from "@/lib/server/db";
import { mergePowerDialerSettings } from "@/lib/products/power-dialer";
import { parseExtendedConfig } from "./campaign-extended-config";
import type { AnswerClassification } from "./types";

export type ScreeningRuntimeDecision =
  | { action: "connect_rep"; reason: string }
  | { action: "notify_rep"; reason: string }
  | { action: "hangup"; reason: string }
  | { action: "voicemail_path"; reason: string };

export async function resolveScreeningDecision(input: {
  workspaceId: string;
  campaignId: string;
  classification: AnswerClassification;
}): Promise<ScreeningRuntimeDecision> {
  const prisma = getPrisma();
  const campaign = await prisma.powerDialerCampaign.findFirst({
    where: { id: input.campaignId, workspaceId: input.workspaceId },
  });
  const ext = parseExtendedConfig(campaign?.configJson);
  const mode = ext.screeningMode || "rep_handles";

  const wsRow = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { customFieldsConfig: true },
  });
  const pd = mergePowerDialerSettings(
    (wsRow?.customFieldsConfig as { powerDialer?: unknown })?.powerDialer,
  );
  const screeningOn = pd.callScreeningEnabled || mode !== "off";

  if (!screeningOn) {
    return { action: "connect_rep", reason: "screening_disabled" };
  }

  if (input.classification === "screener") {
    if (pd.callScreeningSkipRecognized) {
      return { action: "hangup", reason: "recognized_screener_skip" };
    }
    if (pd.callScreeningNotifyRep) {
      return { action: "notify_rep", reason: "screener_notify" };
    }
    if (pd.callScreeningRepHandles || mode === "rep_handles") {
      return { action: "connect_rep", reason: "screener_rep_handles" };
    }
  }

  if (input.classification === "uncertain") {
    const behavior = pd.callScreeningUncertainBehavior || "rep_handles";
    if (behavior === "hangup") return { action: "hangup", reason: "uncertain_hangup" };
    if (behavior === "voicemail") return { action: "voicemail_path", reason: "uncertain_voicemail" };
  }

  return { action: "connect_rep", reason: "default_human_path" };
}
