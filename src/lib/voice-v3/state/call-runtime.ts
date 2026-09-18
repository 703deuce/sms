import type { VoiceV3AgentConfig } from "../config/agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../config/booking-agent-config";
import { applyCallerMeaningToContext } from "../intake/apply-caller-meaning";
import type { CallerMeaning } from "../intake/caller-meaning-schema";
import { buildVoiceV3CallClock } from "../time/call-clock";
import { createInitialVoiceV3CallContext, type VoiceV3CallContext } from "./call-context";
import type { VoiceV3CallEvent } from "./call-events";
import { evaluateVoiceV3Rules, type VoiceV3RuleEvaluation } from "./call-rules";

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

  replaceContext(context: VoiceV3CallContext): void {
    this.context = context;
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

    console.log("CALLER_MEANING_APPLIED", {
      call_id: this.context.callId,
      live_session_id: this.context.liveSessionId,
      state_version: this.context.runtime.version,
      astra_latency_ms: latency,
      fields_changed: applied.fieldsChanged,
      correction_count: applied.correctionCount,
      missing_required_fields: rules.missingRequiredFields,
    });

    console.log("CALL_STATE_VERSION_CHANGED", {
      call_id: this.context.callId,
      live_session_id: this.context.liveSessionId,
      state_version: this.context.runtime.version,
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
      : "authoritative_offer_set=(none)";

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
    offerLine,
  ].join("\n");
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
