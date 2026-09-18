import type { VoiceV3CallRuntime } from "../state/call-runtime";
import { evaluateVoiceV3Rules } from "../state/call-rules";
import type { VoiceV3LiveRuntimeHooks } from "../live-runtime-hooks";
import { syncVoiceV3RecoveryOnContext } from "./sync-recovery";
import type { VoiceV3RecoveryDirective } from "./types";

export function buildLiveRecoverySessionAppend(directive: VoiceV3RecoveryDirective): {
  type: "session.thinking.append";
  content: string;
  delegation_id: null;
} {
  const lines = [
    "Runtime recovery directive (application-owned). Follow this; do not invent backend results.",
    `recovery_code=${directive.code}`,
    `user_recoverable=${directive.userRecoverable}`,
    directive.relatedAction ? `related_action=${directive.relatedAction}` : null,
    directive.missingFieldKey ? `missing_field_key=${directive.missingFieldKey}` : null,
    directive.safeAgentMessage,
  ].filter(Boolean);

  return {
    type: "session.thinking.append",
    content: lines.join("\n"),
    delegation_id: null,
  };
}

export function pushVoiceV3RecoveryToLive(input: {
  runtime: VoiceV3CallRuntime;
  hooks: VoiceV3LiveRuntimeHooks;
  liveSessionId: string;
  forced?: VoiceV3RecoveryDirective | null;
  speakReason?: string;
  /** When true, sync recovery context only — no response.create */
  skipLiveSpeak?: boolean;
}): VoiceV3RecoveryDirective | null {
  const snap = input.runtime.getSnapshot();
  const rules = evaluateVoiceV3Rules(snap, input.runtime.config);
  const synced = syncVoiceV3RecoveryOnContext({
    ctx: snap,
    rules,
    config: input.runtime.config,
    forced: input.forced,
  });
  input.runtime.replaceContext(synced.ctx);

  const directive = synced.directive;
  if (!directive || synced.outcome === "unchanged") {
    return directive;
  }

  const append = buildLiveRecoverySessionAppend(directive);
  input.hooks.onLiveContext?.(append);
  console.log("RECOVERY_CONTEXT_SENT_TO_LIVE", {
    call_id: snap.callId,
    live_session_id: input.liveSessionId,
    recovery_id: directive.id,
    recovery_code: directive.code,
    scheduling_generation: synced.ctx.scheduling.generation,
  });

  if (!input.skipLiveSpeak) {
    input.hooks.requestSpeak?.(
      input.speakReason ?? `recovery_${directive.code.toLowerCase()}`,
    );
  }

  return directive;
}
