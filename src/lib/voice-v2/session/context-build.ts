import "server-only";

import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import { loadVoiceAgentRuntimeConfig } from "@/lib/voice/load-agent-config";
import { parseVoiceAgentConfig } from "@/lib/voice/types";
import { normalizeCallerAni } from "@/lib/voice/call-identity";
import { resolveVoiceV2BookingStrategy } from "../booking-strategy";
import { isVoiceV2PstnLiveBookingMode, isVoiceV2PstnOneAmyMode } from "../pstn-workflow-mode";
import { resolveVoiceV2KnowledgeConfig } from "../knowledge-config";
import { resolveVoiceV2QualificationConfig } from "../qualification-config";
import { resolveAfterHoursHandlingFromAgentAdvanced } from "../after-hours-handling-config";
import { applyCallerAniToIntakeState } from "../intake/caller-phone";
import { compileVoiceV2IntakeSchema } from "../intake/compile-schema";
import type { VoiceV2CallContext, VoiceV2IntakeState } from "../intake/types";
import { buildVoiceV2EnrollmentSnapshot } from "./enrollment";
import type { VoiceV2EnrollmentSnapshot } from "./types";

function prefillPhone(fromE164?: string | null): VoiceV2IntakeState {
  const ani = normalizeCallerAni(fromE164 || "");
  if (!ani) return {};
  return {
    phone: {
      value: ani,
      status: "PREFILLED",
      source: "CALLER_ID",
      updatedAt: new Date().toISOString(),
    },
  };
}

export type BuiltVoiceV2Context = {
  payload: VoiceV2CallContext;
  enrollment: VoiceV2EnrollmentSnapshot;
  bookingTimezone: string;
};

export async function buildVoiceV2CallContextPayload(input: {
  workspaceId: string;
  agentId: string;
  canonicalSessionKey: string;
  callId?: string | null;
  fromE164?: string | null;
}): Promise<BuiltVoiceV2Context> {
  const runtime = await loadVoiceAgentRuntimeConfig(input.workspaceId, input.agentId);
  const config = parseVoiceAgentConfig(runtime);
  const intakeSchema = compileVoiceV2IntakeSchema(config);
  const bookingCfg = await loadMctbAiBookingConfig(input.workspaceId);
  const timezone = bookingCfg.timezone?.trim() || "America/New_York";
  const enrollment = await buildVoiceV2EnrollmentSnapshot({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
  });
  const bookingStrategy = resolveVoiceV2BookingStrategy(config);
  const oneAmy = isVoiceV2PstnOneAmyMode(config);
  const liveBooking = isVoiceV2PstnLiveBookingMode(config);
  const knowledge = resolveVoiceV2KnowledgeConfig(config);
  const qualification = resolveVoiceV2QualificationConfig(config);
  const afterHoursHandling =
    resolveAfterHoursHandlingFromAgentAdvanced(config.advanced as Record<string, unknown>) ||
    undefined;
  let payload: VoiceV2CallContext = {
    sessionKey: input.canonicalSessionKey,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    businessTimezone: timezone,
    intakeSchema,
    intakeState: prefillPhone(input.fromE164),
    askedFields: {},
    compiledAt: new Date().toISOString(),
    intakeSaveCount: 0,
    capabilities: {
      bookingStrategy,
      voiceV2PstnLiveBooking: liveBooking,
      bookingEnabled: liveBooking,
      intakeEnabled: oneAmy,
      knowledgeBaseEnabled: knowledge.knowledgeBaseEnabled,
      knowledgeBaseRevision: knowledge.knowledgeBaseRevision,
      knowledgeBaseIds: knowledge.knowledgeBaseIds,
      qualificationEnabled: qualification.qualificationEnabled,
      qualificationRequiredBeforePrimaryAction:
        qualification.qualificationRequiredBeforePrimaryAction,
      qualificationRevision: qualification.qualificationRevision,
      qualificationRules: qualification.rules,
      qualificationRulesMatchMode: qualification.rulesMatchMode,
      qualificationSupportedZipCodes: qualification.supportedZipCodes,
      qualificationNotQualifiedFallback: qualification.notQualifiedFallback,
      qualificationNeedsReviewFallback: qualification.needsReviewFallback,
      qualificationFieldKeys: qualification.qualificationFieldKeys,
      afterHoursHandling,
      transferToolAvailable: afterHoursHandling?.transferEnabled === true,
      callbackToolAvailable: afterHoursHandling?.callbackRequestsEnabled === true,
      intakeSchemaRevision: enrollment.publishedConfigRevision || undefined,
    },
  };
  payload = applyCallerAniToIntakeState(payload, input.fromE164);
  return { payload, enrollment, bookingTimezone: timezone };
}
