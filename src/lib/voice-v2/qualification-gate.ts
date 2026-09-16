import "server-only";

import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import type { VoiceV2CallContext } from "./intake/types";
import {
  resolveVoiceV2QualificationConfig,
  type VoiceV2PublishedQualificationConfig,
} from "./qualification-config";
import { evaluateVoiceV2Qualification } from "./qualification-evaluator";
import type { VoiceV2QualificationFallbackAction } from "./qualification-types";

export type QualificationPrimaryActionGateResult =
  | { allowed: true }
  | {
      allowed: false;
      status: "QUALIFICATION_BLOCKED";
      speak: string;
      qualificationStatus: string;
      reasonLabel?: string;
      fallback: VoiceV2QualificationFallbackAction;
    };

function speakForBlock(reasonLabel?: string): string {
  if (reasonLabel?.toLowerCase().includes("service area")) {
    return "It looks like that location is outside the area this company currently services. I can still take your information for the team.";
  }
  return "I may not be able to complete that request on this line, but I can take your information for the team.";
}

function pinnedQualificationConfig(
  ctx: VoiceV2CallContext | null | undefined,
): VoiceV2PublishedQualificationConfig | null {
  const cap = ctx?.capabilities;
  if (!cap?.qualificationEnabled) return null;
  if (!cap.qualificationRevision) return null;
  return {
    qualificationEnabled: true,
    qualificationRequiredBeforePrimaryAction: Boolean(
      cap.qualificationRequiredBeforePrimaryAction,
    ),
    qualificationRevision: cap.qualificationRevision,
    rules: cap.qualificationRules || [],
    rulesMatchMode: cap.qualificationRulesMatchMode === "ANY" ? "ANY" : "ALL",
    supportedZipCodes: cap.qualificationSupportedZipCodes || [],
    notQualifiedFallback: cap.qualificationNotQualifiedFallback || "TAKE_MESSAGE",
    needsReviewFallback: cap.qualificationNeedsReviewFallback || "TAKE_MESSAGE",
    qualificationFieldKeys: cap.qualificationFieldKeys || [],
  };
}

export async function evaluateQualificationPrimaryActionGate(input: {
  workspaceId: string;
  agentId: string;
  ctx?: VoiceV2CallContext | null;
}): Promise<QualificationPrimaryActionGateResult> {
  const pinned = pinnedQualificationConfig(input.ctx);
  let config = pinned;
  if (!config) {
    if (input.ctx?.capabilities?.qualificationEnabled === false) {
      return { allowed: true };
    }
    const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
    config = resolveVoiceV2QualificationConfig(parseVoiceAgentConfig(runtime));
  }

  if (!config.qualificationEnabled || !config.qualificationRequiredBeforePrimaryAction) {
    return { allowed: true };
  }
  if (!input.ctx) return { allowed: true };

  const q = input.ctx.qualification ?? evaluateVoiceV2Qualification(input.ctx, config);
  if (q.status === "QUALIFIED" || q.status === "UNKNOWN") {
    return { allowed: true };
  }

  const fallback =
    q.status === "NOT_QUALIFIED"
      ? config.notQualifiedFallback
      : config.needsReviewFallback;

  if (fallback === "CONTINUE_PRIMARY_MODE") {
    return { allowed: true };
  }

  return {
    allowed: false,
    status: "QUALIFICATION_BLOCKED",
    speak: speakForBlock(q.reasonLabel),
    qualificationStatus: q.status,
    reasonLabel: q.reasonLabel,
    fallback,
  };
}
