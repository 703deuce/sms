import type { VoiceV3AgentConfig } from "../config/agent-config";
import { VOICE_V3_BOOKING_AGENT_CONFIG } from "../config/booking-agent-config";
import { buildVoiceV3CallClock } from "../time/call-clock";
import { createInitialVoiceV3CallContext, type VoiceV3CallContext } from "./call-context";
import type { VoiceV3CallEvent } from "./call-events";
import { evaluateVoiceV3Rules } from "./call-rules";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { planAgentState } from "../agent/agent-planner";
import { formatConversationActionForSnapshot } from "../agent/snapshot-format";
import { afterVoiceV3StateChange, type LiveSendFn } from "../agent/after-state-change";
import { deriveVoiceV3Capabilities } from "../agent/capability-state";
import { DEFAULT_VOICE_V3_ESCALATION_POLICY, initialEscalationCounters } from "../agent/escalation";
import { logVoiceV3ContractVersions } from "../telemetry/contract-versions";
import { buildSharedCallerFactsLiveSummary } from "../intake-objective/build-shared-caller-facts";

const liveSendBySession = new Map<string, LiveSendFn>();

export function registerVoiceV3LiveSend(liveSessionId: string, send: LiveSendFn): void {
  liveSendBySession.set(liveSessionId.trim(), send);
}

export function clearVoiceV3LiveSend(liveSessionId: string): void {
  liveSendBySession.delete(liveSessionId.trim());
}

export function getVoiceV3LiveSend(liveSessionId: string): LiveSendFn | undefined {
  return liveSendBySession.get(liveSessionId.trim());
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

  applyEvent(event: VoiceV3CallEvent): void {
    if (event.type === "RUNTIME_DISPOSED") {
      return;
    }
  }
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
  inboundCallerE164?: string | null;
  phoneFoundation?: VoiceV3CallContext["phoneFoundation"];
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
    inboundCallerE164: input.inboundCallerE164,
    phoneFoundation: input.phoneFoundation,
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
  logVoiceV3ContractVersions(config, callId);
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
  const sharedFacts = buildSharedCallerFactsLiveSummary(runtime.config, ctx);
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
    sharedFacts,
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
