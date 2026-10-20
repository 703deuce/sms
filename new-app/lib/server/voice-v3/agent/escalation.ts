import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RecoveryCode } from "../recovery/types";

export type VoiceV3FallbackKind = "TRANSFER" | "CALLBACK" | "MESSAGE" | "VOICEMAIL";

export interface VoiceV3EscalationPolicy {
  maxSemanticFailures: number;
  maxClarificationAttempts: number;
  maxRepeatedBlockerAttempts: number;
  fallbackPriority: VoiceV3FallbackKind[];
}

export const DEFAULT_VOICE_V3_ESCALATION_POLICY: VoiceV3EscalationPolicy = {
  maxSemanticFailures: 2,
  maxClarificationAttempts: 3,
  maxRepeatedBlockerAttempts: 3,
  fallbackPriority: ["TRANSFER", "CALLBACK", "MESSAGE", "VOICEMAIL"],
};

export interface EscalationCounters {
  semanticFailures: number;
  clarificationByCode: Record<string, number>;
  repeatedBlockerCode: string | null;
  repeatedBlockerCount: number;
  explicitHandoffRequested: boolean;
}

export function initialEscalationCounters(): EscalationCounters {
  return {
    semanticFailures: 0,
    clarificationByCode: {},
    repeatedBlockerCode: null,
    repeatedBlockerCount: 0,
    explicitHandoffRequested: false,
  };
}

export function recordSemanticFailure(ctx: VoiceV3CallContext): VoiceV3CallContext {
  const esc = ctx.escalation ?? { policy: DEFAULT_VOICE_V3_ESCALATION_POLICY, counters: initialEscalationCounters() };
  return {
    ...ctx,
    escalation: {
      ...esc,
      counters: {
        ...esc.counters,
        semanticFailures: esc.counters.semanticFailures + 1,
      },
    },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

export function recordBlockerSeen(ctx: VoiceV3CallContext, code: VoiceV3RecoveryCode): VoiceV3CallContext {
  const esc = ctx.escalation ?? { policy: DEFAULT_VOICE_V3_ESCALATION_POLICY, counters: initialEscalationCounters() };
  const prev = esc.counters.repeatedBlockerCode;
  const count = prev === code ? esc.counters.repeatedBlockerCount + 1 : 1;
  const clarificationByCode = { ...esc.counters.clarificationByCode };
  clarificationByCode[code] = (clarificationByCode[code] ?? 0) + 1;
  return {
    ...ctx,
    escalation: {
      ...esc,
      counters: {
        ...esc.counters,
        repeatedBlockerCode: code,
        repeatedBlockerCount: count,
        clarificationByCode,
      },
    },
  };
}

export function recordExplicitHandoff(ctx: VoiceV3CallContext): VoiceV3CallContext {
  const esc = ctx.escalation ?? { policy: DEFAULT_VOICE_V3_ESCALATION_POLICY, counters: initialEscalationCounters() };
  return {
    ...ctx,
    escalation: {
      ...esc,
      counters: { ...esc.counters, explicitHandoffRequested: true },
    },
    handoff: { ...ctx.handoff, requested: true, reason: "caller_requested_human" },
    runtime: { version: ctx.runtime.version + 1 },
  };
}

export function shouldOfferHandoff(ctx: VoiceV3CallContext): {
  required: boolean;
  fallback: VoiceV3FallbackKind | null;
  reason: string;
} {
  const esc = ctx.escalation;
  if (!esc) return { required: false, fallback: null, reason: "" };
  if (esc.counters.explicitHandoffRequested && ctx.capabilities?.canTransfer) {
    return { required: true, fallback: "TRANSFER", reason: "caller_requested_human" };
  }
  const policy = esc.policy;
  if (esc.counters.semanticFailures >= policy.maxSemanticFailures) {
    return {
      required: true,
      fallback: policy.fallbackPriority[0] ?? "CALLBACK",
      reason: "semantic_failures_threshold",
    };
  }
  if (esc.counters.repeatedBlockerCount >= policy.maxRepeatedBlockerAttempts) {
    return {
      required: true,
      fallback: policy.fallbackPriority[0] ?? "CALLBACK",
      reason: "repeated_blocker_threshold",
    };
  }
  const activeCode = ctx.recovery.active?.code;
  if (activeCode) {
    const c = esc.counters.clarificationByCode[activeCode] ?? 0;
    if (c >= policy.maxClarificationAttempts) {
      return {
        required: true,
        fallback: policy.fallbackPriority[0] ?? "CALLBACK",
        reason: `clarification_threshold_${activeCode}`,
      };
    }
  }
  return { required: false, fallback: null, reason: "" };
}
