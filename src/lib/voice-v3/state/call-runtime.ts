import type { VoiceV3AgentConfig } from "../config/agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../config/booking-agent-config";
import { applyCallerMeaningToContext } from "../intake/apply-caller-meaning";
import type { CallerMeaning } from "../intake/caller-meaning-schema";
import { buildVoiceV3CallClock } from "../time/call-clock";
import { createInitialVoiceV3CallContext, type VoiceV3CallContext } from "./call-context";
import type { VoiceV3CallEvent } from "./call-events";
import { evaluateVoiceV3Rules, type VoiceV3RuleEvaluation } from "./call-rules";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { planAgentState } from "../agent/agent-planner";
import { formatConversationActionForSnapshot } from "../agent/snapshot-format";
import { afterVoiceV3StateChange, type LiveSendFn } from "../agent/after-state-change";
import { deriveVoiceV3Capabilities } from "../agent/capability-state";
import { DEFAULT_VOICE_V3_ESCALATION_POLICY, initialEscalationCounters } from "../agent/escalation";

const liveSendBySession = new Map<string, LiveSendFn>();

export function registerVoiceV3LiveSend(liveSessionId: string, send: LiveSendFn): void {
  liveSendBySession.set(liveSessionId.trim(), send);
}

export function clearVoiceV3LiveSend(liveSessionId: string): void {
  liveSendBySession.delete(liveSessionId.trim());
}

const TTL_MS = 2 * 60 * 60 * 1000;
const runtimes = new Map<
  string,
  { runtime: VoiceV3CallRuntime; expiresAt: number }
>();

export class VoiceV3CallRuntime {
  readonly config: VoiceV3AgentConfig;
  private context: VoiceV3CallContext;

  constructor(input: {
    config: VoiceV3AgentConfig;
    context: VoiceV3CallContext;
  }) {
    this.config = input.config;
    this.context = input.context;
  }

  getSnapshot(): VoiceV3CallContext {
    return this.context;
  }

  commitContext(context: VoiceV3CallContext, reason: string, send?: LiveSendFn): void {
    this.context = this.ensureAgentFields(context);
    const liveSend = send ?? liveSendBySession.get(this.context.liveSessionId);
    afterVoiceV3StateChange({ runtime: this, reason, send: liveSend });
  }

  replaceContext(context: VoiceV3CallContext): void {
    this.commitContext(context, "replace_context");
  }

  replan(reason: string, send?: LiveSendFn): void {
    afterVoiceV3StateChange({ runtime: this, reason, send: send ?? liveSendBySession.get(this.context.liveSessionId) });
  }

  private ensureAgentFields(context: VoiceV3CallContext): VoiceV3CallContext {
    return {
      ...context,
      operations: context.operations ?? {},
      capabilities: context.capabilities ?? deriveVoiceV3Capabilities(this.config),
      escalation: context.escalation ?? {
        policy: DEFAULT_VOICE_V3_ESCALATION_POLICY,
        counters: initialEscalationCounters(),
      },
    };
  }

  applyEvent(event: VoiceV3CallEvent): {
    rules: VoiceV3RuleEvaluation;
    fieldsChanged: string[];
    correctionCount: number;
  } {
    if (event.type === "RUNTIME_DISPOSED") {
      return {
        rules: evaluateVoiceV3Rules(this.context, this.config),
        fieldsChanged: [],
        correctionCount: 0,
      };
    }

    const started = Date.now();
    const applied = applyCallerMeaningToContext(this.context, this.config, event.meaning);
    this.context = applied.context;

    const rules = evaluateVoiceV3Rules(this.context, this.config);
    const latency = event.astraLatencyMs ?? Date.now() - started;

    const sched = this.context.scheduling.normalized;
    console.log("CALLER_MEANING_APPLIED", {
      call_id: this.context.callId,
      live_session_id: this.context.liveSessionId,
      state_version: this.context.runtime.version,
      astra_latency_ms: latency,
      active_goal: this.context.dialog.activeGoal,
      captured_field_keys: Object.keys(this.context.intake.values).filter((k) =>
        Boolean(this.context.intake.values[k]?.value?.trim()),
      ),
      fields_changed: applied.fieldsChanged,
      correction_count: applied.correctionCount,
      scheduling_generation: this.context.scheduling.generation,
      scheduling_precision: sched?.precision ?? null,
      scheduling_local_date: sched?.localDate ?? null,
      scheduling_daypart: this.context.scheduling.meaning?.daypart ?? null,
      scheduling_time_kind: this.context.scheduling.meaning?.time_kind ?? null,
      missing_required_field_keys: rules.missingRequiredFields,
      find_ready: rules.findReady,
      booking_ready: rules.bookingReady,
    });

    console.log("CALL_STATE_VERSION_CHANGED", {
      call_id: this.context.callId,
      live_session_id: this.context.liveSessionId,
      state_version: this.context.runtime.version,
    });

    logVoiceV3Pipeline("rules", "evaluated", {
      call_id: this.context.callId,
      live_session_id: this.context.liveSessionId,
      state_version: this.context.runtime.version,
      intake_complete: rules.intakeComplete,
      missing_required_fields: rules.missingRequiredFields,
      has_scheduling_preference: rules.hasSchedulingPreference,
      scheduling_requires_clarification: rules.schedulingRequiresClarification,
      scheduling_clarification_reason: rules.schedulingClarificationReason,
      required_action: rules.requiredAction,
      may_find_availability: rules.mayFindAvailability,
      booking_ready: rules.bookingReady,
      slot_selected: rules.slotSelected,
      scheduling_generation: this.context.scheduling.generation,
    });

    console.log("RULES_EVALUATED", {
      call_id: this.context.callId,
      live_session_id: this.context.liveSessionId,
      state_version: this.context.runtime.version,
      intake_complete: rules.intakeComplete,
      missing_required_fields: rules.missingRequiredFields,
      has_scheduling_preference: rules.hasSchedulingPreference,
      scheduling_requires_clarification: rules.schedulingRequiresClarification,
      required_action: rules.requiredAction,
      may_find_availability: rules.mayFindAvailability,
      scheduling_generation: this.context.scheduling.generation,
    });

    void persistSnapshot(this).catch((err) => {
      console.error("VOICE_V3_PERSIST_SNAPSHOT_FAILED", {
        live_session_id: this.context.liveSessionId,
        err,
      });
    });

    this.replan("caller_meaning_applied");

    return {
      rules,
      fieldsChanged: applied.fieldsChanged,
      correctionCount: applied.correctionCount,
    };
  }
}

async function persistSnapshot(runtime: VoiceV3CallRuntime): Promise<void> {
  // Placeholder for future durable store — intentionally non-blocking.
  void runtime.getSnapshot();
}

function prune(now: number): void {
  for (const [key, row] of runtimes) {
    if (row.expiresAt <= now) runtimes.delete(key);
  }
}

export function voiceV3IntakePipelineEnabled(): boolean {
  const raw = process.env.VOICE_V3_INTAKE_ENABLED?.trim();
  if (raw === "0" || raw === "false") return false;
  return true;
}

/** Single production config for PSTN, Live accept, sideband, FIND, BOOK. */
export function resolveVoiceV3AgentConfig(): VoiceV3AgentConfig {
  return VOICE_V3_BOOKING_AGENT_CONFIG;
}

export function createVoiceV3CallRuntime(input: {
  liveSessionId: string;
  callId?: string | null;
  config?: VoiceV3AgentConfig;
  now?: Date;
}): VoiceV3CallRuntime {
  const config = input.config ?? resolveVoiceV3AgentConfig();
  const now = input.now ?? new Date();
  const clock = buildVoiceV3CallClock(config.timezone, now);
  const callId = (input.callId?.trim() || input.liveSessionId).trim();
  const context = createInitialVoiceV3CallContext({
    callId,
    liveSessionId: input.liveSessionId.trim(),
    timezone: config.timezone,
    clock,
    now,
  });

  const runtime = new VoiceV3CallRuntime({ config, context });
  const expiresAt = Date.now() + TTL_MS;
  runtimes.set(input.liveSessionId.trim(), { runtime, expiresAt });

  const connectionId = config.calendar?.connectionId?.trim();
  const intakeKeys = config.intakeFields.map((f) => f.key);
  logVoiceV3Pipeline("runtime", "created", {
    live_session_id: input.liveSessionId,
    call_id: callId,
    intake_field_keys: intakeKeys,
    calendar_connection_configured: Boolean(connectionId),
    service_id: config.service.id,
    timezone: config.timezone,
  });

  console.log("VOICE_V3_BOOKING_PIPELINE_ACTIVE", {
    live_session_id: input.liveSessionId,
    call_id: callId,
    intake_field_keys: intakeKeys,
    calendar_connection_configured: Boolean(connectionId),
    service_id: config.service.id,
  });
  if (!connectionId) {
    console.error("VOICE_V3_CALENDAR_CONFIG_MISSING", {
      live_session_id: input.liveSessionId,
      hint: "Set VOICE_V3_MICROSOFT_CONNECTION_ID for Microsoft FIND/BOOK",
    });
  }

  return runtime;
}

export function getVoiceV3CallRuntime(liveSessionId: string): VoiceV3CallRuntime | null {
  const id = liveSessionId.trim();
  if (!id) return null;
  const now = Date.now();
  prune(now);
  const row = runtimes.get(id);
  if (!row) return null;
  if (row.expiresAt <= now) {
    runtimes.delete(id);
    return null;
  }
  row.expiresAt = now + TTL_MS;
  return row.runtime;
}

export function deleteVoiceV3CallRuntime(liveSessionId: string): void {
  const runtime = getVoiceV3CallRuntime(liveSessionId);
  if (runtime) {
    runtime.applyEvent({ type: "RUNTIME_DISPOSED" });
  }
  runtimes.delete(liveSessionId.trim());
}

/** Test-only */
export function clearVoiceV3CallRuntimeStore(): void {
  runtimes.clear();
}

export function buildAuthoritativeThinkingSnapshot(
  runtime: VoiceV3CallRuntime,
): string {
  const ctx = runtime.getSnapshot();
  const rules = evaluateVoiceV3Rules(ctx, runtime.config);
  const known = Object.keys(ctx.intake.values)
    .filter((k) => ctx.intake.values[k]?.value?.trim())
    .map((k) => `${k} known`)
    .join(", ");
  const missing = rules.missingRequiredFields.join(", ") || "(none)";

  const sched = ctx.scheduling.normalized;
  const schedLine = sched
    ? `scheduling_generation=${ctx.scheduling.generation} precision=${sched.precision} local_date=${sched.localDate ?? "(none)"}`
    : `scheduling_generation=${ctx.scheduling.generation}`;

  const clarifyLine =
    rules.schedulingRequiresClarification && rules.schedulingClarificationPrompt
      ? `scheduling_clarification_required: ${rules.schedulingClarificationPrompt}`
      : "scheduling_clarification_required=false";

  const offer = ctx.availability.activeOfferSet;
  const offerLine = offer
    ? `authoritative_offer_set_id=${offer.offerSetId} slot_count=${offer.slots.length}`
    : ctx.availability.status === "failed"
      ? "availability_lookup_failed=true"
      : ctx.availability.status === "pending"
        ? "availability_lookup_in_progress=true"
        : "authoritative_offer_set=(none)";

  const agent = planAgentState(ctx, runtime.config);
  const needLine = `next_conversation_need=${formatConversationActionForSnapshot(agent.nextConversationAction)}`;
  const claimsLine = `allowed_claims=${agent.allowedClaims.join(",") || "(none)"}`;
  const forbidLine = `forbidden_claims=${agent.forbiddenClaims.join(",") || "(none)"}`;

  return [
    "Authoritative caller state updated (application-owned).",
    `state_version=${ctx.runtime.version}`,
    `goal=${ctx.dialog.activeGoal}`,
    known ? `captured: ${known}` : "captured: (none)",
    `missing_required: ${missing}`,
    `intake_complete=${rules.intakeComplete}`,
    schedLine,
    clarifyLine,
    `may_run_calendar_action=${rules.mayRunCalendarAction}`,
    `find_ready=${rules.findReady}`,
    `booking_ready=${rules.bookingReady}`,
    offerLine,
    needLine,
    claimsLine,
    forbidLine,
    agent.blocker ? `blocker=${agent.blocker.code}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildSessionThinkingAppendForRuntime(
  runtime: VoiceV3CallRuntime,
): {
  type: "session.thinking.append";
  content: string;
  delegation_id: null;
} {
  return {
    type: "session.thinking.append",
    content: buildAuthoritativeThinkingSnapshot(runtime),
    delegation_id: null,
  };
}
