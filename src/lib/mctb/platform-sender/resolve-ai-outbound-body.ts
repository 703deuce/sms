import type { LeadRecoveryInboundResult } from "@/lib/mctb/lead-recovery/types";
import { loadMctbAiBookingConfig, resolveFallbackBookingUrl } from "@/lib/mctb/ai-booking/config";
import { hasMctbAiBookingEntitlement } from "@/lib/mctb/ai-booking/entitlement";
import { loadLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { getPrisma } from "@/lib/db";
import type { MissedCallTextConfigRecord } from "@/lib/agents/missed-call-text-back/types";
import {
  renderPlatformResponseTemplate,
} from "@/lib/mctb/platform-sender/platform-response-registry";
import { selectPlatformResponseForLeadRecovery } from "@/lib/mctb/platform-sender/map-lead-recovery-platform-response";
import type { PlatformResponseId } from "@/lib/mctb/platform-sender/platform-response-ids";

export type MctbAiOutboundBodyResolution = {
  body: string;
  senderMode: "PLATFORM" | "WORKSPACE";
  platformResponseId?: PlatformResponseId;
  usedModelAuthoredText: boolean;
  failClosed?: boolean;
};

async function resolveBookingUrl(workspaceId: string): Promise<string | null> {
  const lrConfig = await loadLeadRecoveryConfig(workspaceId);
  if (lrConfig.bookingLinkId) {
    const prisma = getPrisma();
    const row = await prisma.mctbBookingLink.findFirst({
      where: { workspaceId, id: lrConfig.bookingLinkId, active: true },
    });
    if (row?.url) return row.url;
  }
  const aiCfg = await loadMctbAiBookingConfig(workspaceId);
  return resolveFallbackBookingUrl(workspaceId, aiCfg);
}

async function loadBusinessDisplayName(workspaceId: string): Promise<string> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  return (ws?.name || "our team").trim().slice(0, 120);
}

/**
 * Authoritative outbound SMS body for MCTB AI Lead Recovery replies.
 * PLATFORM: deterministic Transovo templates only (fail closed).
 * WORKSPACE: preserve model/runtime-authored reply text.
 */
export async function resolveMctbAiOutboundSmsBody(input: {
  workspaceId: string;
  config: MissedCallTextConfigRecord;
  leadRecovery: Extract<LeadRecoveryInboundResult, { handled: true }>;
  callerFirstName?: string | null;
}): Promise<MctbAiOutboundBodyResolution> {
  const senderMode = input.config.senderMode === "PLATFORM" ? "PLATFORM" : "WORKSPACE";
  const modelReply = input.leadRecovery.reply?.trim() || "";

  if (senderMode === "WORKSPACE") {
    return {
      body: modelReply,
      senderMode,
      usedModelAuthoredText: true,
    };
  }

  try {
    const [businessName, bookingEntitled, bookingUrl] = await Promise.all([
      loadBusinessDisplayName(input.workspaceId),
      hasMctbAiBookingEntitlement(input.workspaceId),
      resolveBookingUrl(input.workspaceId),
    ]);

    const selection = selectPlatformResponseForLeadRecovery({
      runtimeAction: input.leadRecovery.action,
      policy: input.leadRecovery.policy,
      bookingEntitled,
      bookingUrl,
      businessName,
      callerFirstName: input.callerFirstName,
    });

    const body = renderPlatformResponseTemplate(selection.responseId, selection.variables);

    return {
      body,
      senderMode,
      platformResponseId: selection.responseId,
      usedModelAuthoredText: false,
    };
  } catch (err) {
    console.warn("[mctb/platform-sender] platform render failed — safe fallback", err);
    const businessName = await loadBusinessDisplayName(input.workspaceId);
    const body = renderPlatformResponseTemplate("SAFE_FALLBACK", { businessName });
    return {
      body,
      senderMode: "PLATFORM",
      platformResponseId: "SAFE_FALLBACK",
      usedModelAuthoredText: false,
      failClosed: true,
    };
  }
}
