import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type { VoiceV3RuleEvaluation } from "../state/call-rules";
import { evaluateVoiceV3Recovery } from "./evaluate-recovery";
import type { VoiceV3RecoveryDirective } from "./types";

export type RecoverySyncOutcome =
  | "unchanged"
  | "created"
  | "resolved"
  | "superseded";

function directiveKey(d: VoiceV3RecoveryDirective): string {
  return `${d.code}:${d.missingFieldKey ?? ""}:${d.relatedAction ?? ""}`;
}

export function syncVoiceV3RecoveryOnContext(input: {
  ctx: VoiceV3CallContext;
  rules: VoiceV3RuleEvaluation;
  config: VoiceV3AgentConfig;
  forced?: VoiceV3RecoveryDirective | null;
  now?: Date;
}): { ctx: VoiceV3CallContext; directive: VoiceV3RecoveryDirective | null; outcome: RecoverySyncOutcome } {
  const at = input.now ?? new Date();
  const next =
    input.forced !== undefined
      ? input.forced
      : evaluateVoiceV3Recovery({
          ctx: input.ctx,
          rules: input.rules,
          config: input.config,
          now: at,
        });

  const prev = input.ctx.recovery.active;

  if (!next && !prev) {
    return { ctx: input.ctx, directive: null, outcome: "unchanged" };
  }

  if (!next && prev) {
    const resolved: VoiceV3RecoveryDirective = {
      ...prev,
      status: "RESOLVED",
      resolvedAt: at.toISOString(),
    };
    console.log("RECOVERY_DIRECTIVE_RESOLVED", {
      call_id: input.ctx.callId,
      live_session_id: input.ctx.liveSessionId,
      recovery_id: prev.id,
      recovery_code: prev.code,
      scheduling_generation: input.ctx.scheduling.generation,
    });
    return {
      ctx: {
        ...input.ctx,
        recovery: { active: null, lastResolved: resolved },
        runtime: { version: input.ctx.runtime.version + 1 },
      },
      directive: null,
      outcome: "resolved",
    };
  }

  if (next && prev && directiveKey(next) === directiveKey(prev)) {
    return { ctx: input.ctx, directive: prev, outcome: "unchanged" };
  }

  if (next && prev) {
    const superseded: VoiceV3RecoveryDirective = {
      ...prev,
      status: "SUPERSEDED",
      resolvedAt: at.toISOString(),
    };
    console.log("RECOVERY_DIRECTIVE_SUPERSEDED", {
      call_id: input.ctx.callId,
      live_session_id: input.ctx.liveSessionId,
      recovery_id: prev.id,
      recovery_code: prev.code,
      next_code: next.code,
      scheduling_generation: input.ctx.scheduling.generation,
    });
    void superseded;
  }

  if (next) {
    console.log("RECOVERY_DIRECTIVE_CREATED", {
      call_id: input.ctx.callId,
      live_session_id: input.ctx.liveSessionId,
      recovery_id: next.id,
      recovery_code: next.code,
      related_action: next.relatedAction ?? null,
      missing_field_key: next.missingFieldKey ?? null,
      scheduling_generation: input.ctx.scheduling.generation,
    });
    console.log("WORKFLOW_BLOCKED", {
      call_id: input.ctx.callId,
      live_session_id: input.ctx.liveSessionId,
      recovery_code: next.code,
      related_action: next.relatedAction ?? null,
      scheduling_generation: input.ctx.scheduling.generation,
    });
  }

  return {
    ctx: {
      ...input.ctx,
      recovery: { active: next, lastResolved: input.ctx.recovery.lastResolved },
      runtime: { version: input.ctx.runtime.version + 1 },
    },
    directive: next,
    outcome: next && prev ? "superseded" : "created",
  };
}
