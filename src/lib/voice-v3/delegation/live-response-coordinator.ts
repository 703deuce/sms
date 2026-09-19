import type { LiveSidebandSend } from "../greeting";
import { noteTurnDelegationContinued } from "../conversation/caller-turn-semantic-progress";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { noteSemanticTimingEvent } from "../telemetry/caller-turn-timing";
import { getVoiceV3CallRuntime } from "../state/call-runtime";
import { getCurrentConversationRevision } from "../conversation/conversation-revision";
import type { DelegationRuntime, PendingFunctionCall } from "./types";

type ContinuationRequest = {
  reason: string;
  eventId?: string;
  stateVersion?: number;
  actionKey?: string;
};

export type LiveSpeakRequestStatus =
  | "QUEUED"
  | "SENT"
  | "SUPERSEDED"
  | "CANCELLED"
  | "FAILED";

type LiveSpeakRequest = {
  speakRequestId: string;
  stateVersion?: number;
  actionKey: string;
  sessionEpoch: number;
  status: LiveSpeakRequestStatus;
  reason: string;
};

export class VoiceV3LiveResponseCoordinator {
  readonly liveSessionId: string;
  private send: LiveSidebandSend;
  private delegations = new Map<string, DelegationRuntime>();
  private activeDelegationId: string | null = null;
  private pendingByCallId = new Map<string, PendingFunctionCall>();
  private continuationQueue: ContinuationRequest[] = [];
  private continuationFlushScheduled = false;
  private sessionEpoch = 1;
  private sessionClosed = false;
  private speakRequests = new Map<string, LiveSpeakRequest>();
  private sentSpeakKeys = new Set<string>();
  /** One delegated protocol continuation per tool-output barrier (delegationId + generation). */
  private delegatedProtocolContinuationSent = new Set<string>();
  /** When Live omits delegation_id, correlate barriers per session. */
  private protocolBarrierGenerationGlobal = 0;

  constructor(liveSessionId: string, send: LiveSidebandSend) {
    this.liveSessionId = liveSessionId.trim();
    this.send = send;
  }

  updateSend(send: LiveSidebandSend): void {
    this.send = send;
  }

  onDelegationCreated(delegation: {
    id?: string;
    response_id?: string;
    offset_ms?: number;
  }): void {
    const delegationId = typeof delegation.id === "string" ? delegation.id : null;
    if (!delegationId) return;

    this.activeDelegationId = delegationId;
    const basedOnConversationRevision = getCurrentConversationRevision(this.liveSessionId);
    const existing = this.delegations.get(delegationId);
    if (!existing) {
      this.delegations.set(delegationId, {
        delegationId,
        responseId: delegation.response_id,
        basedOnConversationRevision,
        delegationCreatedOffsetMs: delegation.offset_ms,
        semanticFreshness: "FRESH",
        phase: "STARTED",
        pendingFunctionCalls: new Map(),
        submittedFunctionCallIds: new Set(),
        observedFunctionNames: [],
        messageOutputOccurred: false,
        protocolBarrierGeneration: 0,
        lastContinuationEventId: null,
      });
    }
    console.log("DELEGATION_REVISION_SNAPSHOTTED", {
      live_session_id: this.liveSessionId,
      delegation_id: delegationId,
      based_on_conversation_revision: basedOnConversationRevision,
      offset_ms: delegation.offset_ms ?? null,
      response_id: delegation.response_id ?? null,
    });
    logVoiceV3Pipeline("live_out", "delegation.registered", {
      live_session_id: this.liveSessionId,
      delegation_id: delegationId,
      based_on_conversation_revision: basedOnConversationRevision,
    });
    noteSemanticTimingEvent(this.liveSessionId, "delegationCreatedAt");
    noteSemanticTimingEvent(this.liveSessionId, "delegationCount");
  }

  markDelegationsSemanticallyStale(currentConversationRevision: number): void {
    for (const d of this.delegations.values()) {
      if (
        d.semanticFreshness === "FRESH" &&
        currentConversationRevision > d.basedOnConversationRevision
      ) {
        d.semanticFreshness = "STALE";
        console.log("DELEGATION_SEMANTICALLY_STALE", {
          live_session_id: this.liveSessionId,
          delegation_id: d.delegationId,
          based_on_conversation_revision: d.basedOnConversationRevision,
          current_conversation_revision: currentConversationRevision,
        });
      }
    }
  }

  getDelegationRuntime(delegationId: string | null | undefined): DelegationRuntime | null {
    if (!delegationId?.trim()) return null;
    return this.delegations.get(delegationId.trim()) ?? null;
  }

  isDelegationSemanticallyStale(delegationId: string | null | undefined): boolean {
    const d = this.getDelegationRuntime(delegationId);
    return d?.semanticFreshness === "STALE";
  }

  registerPendingFunctionCall(call: PendingFunctionCall): boolean {
    if (this.pendingByCallId.has(call.callId)) {
      return false;
    }
    const delegationId = call.delegationId ?? this.activeDelegationId;
    const enriched: PendingFunctionCall = { ...call, delegationId, outputSubmitted: false };
    this.pendingByCallId.set(call.callId, enriched);

    if (delegationId) {
      const d =
        this.delegations.get(delegationId) ??
        ({
          delegationId,
          responseId: undefined,
          basedOnConversationRevision: getCurrentConversationRevision(this.liveSessionId),
          semanticFreshness: "FRESH",
          phase: "AWAITING_TOOL_OUTPUT",
          pendingFunctionCalls: new Map(),
          submittedFunctionCallIds: new Set(),
          observedFunctionNames: [],
          messageOutputOccurred: false,
          protocolBarrierGeneration: 0,
          lastContinuationEventId: null,
        } satisfies DelegationRuntime);
      d.phase = "AWAITING_TOOL_OUTPUT";
      d.pendingFunctionCalls.set(call.callId, enriched);
      this.delegations.set(delegationId, d);
    }

    logVoiceV3Pipeline("live_out", "function_call.pending", {
      live_session_id: this.liveSessionId,
      call_id: call.callId,
      name: call.name,
      delegation_id: delegationId,
    });
    return true;
  }

  hasPendingFunctionOutputs(): boolean {
    for (const row of this.pendingByCallId.values()) {
      if (!row.outputSubmitted) return true;
    }
    return false;
  }

  hasOpenDelegationAwaitingTool(): boolean {
    if (this.hasPendingFunctionOutputs()) return true;
    for (const d of this.delegations.values()) {
      if (d.phase === "AWAITING_TOOL_OUTPUT") return true;
    }
    return false;
  }

  onDelegatedNestedResponseEvent(
    delegationId: string | null | undefined,
    nested: Record<string, unknown>,
  ): void {
    const id =
      typeof delegationId === "string" && delegationId.trim()
        ? delegationId.trim()
        : this.activeDelegationId;
    if (id) {
      this.onDelegationCreated({ id });
      const d = this.delegations.get(id);
      if (d && d.phase === "STARTED") {
        d.phase = "STREAMING";
      }
    }

    const nestedType = String(nested.type || "");
    if (nestedType === "response.created" || nestedType === "response.in_progress") {
      if (id) {
        const d = this.delegations.get(id);
        if (d) d.phase = "STREAMING";
      }
      return;
    }

    if (nestedType === "response.output_item.done" && id) {
      const item = nested.item;
      if (item && typeof item === "object") {
        const row = item as Record<string, unknown>;
        const d = this.delegations.get(id);
        if (d) {
          if (row.type === "message") {
            d.messageOutputOccurred = true;
          }
          if (row.type === "function_call" && typeof row.name === "string" && row.name.trim()) {
            d.observedFunctionNames.push(row.name.trim());
          }
        }
      }
    }

    if (nestedType === "response.completed") {
      const d = id ? this.delegations.get(id) : undefined;
      if (id && d) {
        d.phase = "COMPLETED";
      }
      this.protocolBarrierGenerationGlobal += 1;
      const runtime = getVoiceV3CallRuntime(this.liveSessionId);
      const snap = runtime?.getSnapshot() ?? null;
      const config = runtime?.config ?? null;
      const functionNames = d?.observedFunctionNames ?? [];
      const callbackEnabled = config?.callHandling.callbackRequestsEnabled === true;
      const callbackPersisted = Boolean(snap?.callback?.callbackRequestId);
      logVoiceV3Pipeline("live_out", "delegation.completed", {
        live_session_id: this.liveSessionId,
        delegation_id: id,
      });
      console.log("ASTRA_DELEGATION_COMPLETED", {
        live_session_id: this.liveSessionId,
        delegation_id: id,
        active_goal: snap?.dialog.activeGoal ?? null,
        function_call_count: functionNames.length,
        function_names: functionNames,
        message_output_occurred: d?.messageOutputOccurred ?? false,
        callback_enabled: callbackEnabled,
        callback_request_persisted: callbackPersisted,
        callback_open:
          callbackEnabled && !callbackPersisted && functionNames.length === 0
            ? d?.messageOutputOccurred ?? false
            : false,
      });
      console.log("DELEGATED_CONTINUATION_COMPLETED", {
        live_session_id: this.liveSessionId,
        delegation_id: id,
        response_id: this.delegations.get(id ?? "")?.responseId ?? null,
        continuation_event_id: this.delegations.get(id ?? "")?.lastContinuationEventId ?? null,
      });
      noteSemanticTimingEvent(this.liveSessionId, "delegatedResponseCompletedAt");
      this.scheduleContinuationFlush();
      return;
    }

    if (nestedType === "response.failed") {
      if (id) {
        const d = this.delegations.get(id);
        if (d) d.phase = "FAILED";
      }
      console.log("ASTRA_DELEGATION_FAILED", {
        live_session_id: this.liveSessionId,
        delegation_id: id,
      });
      return;
    }

    if (nestedType === "response.incomplete") {
      if (id) {
        const d = this.delegations.get(id);
        if (d) d.phase = "INCOMPLETE";
      }
      console.log("ASTRA_DELEGATION_INCOMPLETE", {
        live_session_id: this.liveSessionId,
        delegation_id: id,
      });
    }
  }

  submitDelegatedFunctionCallOutput(input: {
    callId: string;
    delegationId: string | null;
    callerTurnId: string | null;
    semanticDisposition: string;
    output: Record<string, unknown>;
    startedAtMs?: number;
  }): boolean {
    const row = this.pendingByCallId.get(input.callId);
    if (!row || row.outputSubmitted) {
      return false;
    }

    const startedAt = input.startedAtMs ?? Date.now();
    const pendingBeforeSubmit = this.pendingOutstandingCount();
    row.outputSubmitted = true;
    const eventId = `voice_v3_fn_out_${this.liveSessionId}_${input.callId}_${Date.now()}`;
    const payload = {
      type: "response.item.create",
      event_id: eventId,
      item: {
        type: "function_call_output",
        call_id: input.callId,
        output: JSON.stringify(input.output),
      },
    };

    logVoiceV3Pipeline("live_out", "response.item.create", {
      live_session_id: this.liveSessionId,
      call_id: input.callId,
      event_id: eventId,
      name: row.name,
    });

    console.log("DELEGATED_FUNCTION_OUTPUT_SUBMITTED", {
      live_session_id: this.liveSessionId,
      call_id: input.callId,
      function_call_id: input.callId,
      name: row.name,
      delegation_id: input.delegationId ?? row.delegationId,
      caller_turn_id: input.callerTurnId,
      semantic_disposition: input.semanticDisposition,
      pending_output_count: Math.max(0, pendingBeforeSubmit - 1),
      event_id: eventId,
      elapsed_ms: Date.now() - startedAt,
    });

    console.log("LIVE_FUNCTION_CALL_OUTPUT_SUBMITTED", {
      live_session_id: this.liveSessionId,
      call_id: input.callId,
      name: row.name,
      delegation_id: row.delegationId,
    });

    this.send(payload);

    const delegationId = input.delegationId ?? row.delegationId;
    if (delegationId) {
      const d = this.delegations.get(delegationId);
      if (d) {
        d.submittedFunctionCallIds.add(input.callId);
        const pendingLeft = [...d.pendingFunctionCalls.values()].some((c) => !c.outputSubmitted);
        if (!pendingLeft) {
          d.phase = "TOOL_OUTPUT_SUBMITTED";
        }
      }
    }

    if (!this.hasPendingFunctionOutputs()) {
      this.requestDelegatedProtocolContinuation({
        delegationId,
        triggerCallId: input.callId,
        callerTurnId: input.callerTurnId,
        semanticDisposition: input.semanticDisposition,
        startedAtMs: startedAt,
      });
      this.scheduleContinuationFlush();
    }
    return true;
  }

  /** @deprecated Use submitDelegatedFunctionCallOutput */
  submitFunctionCallOutput(
    callId: string,
    output: Record<string, unknown>,
    _options?: { skipScheduleContinuation?: boolean },
  ): boolean {
    return this.submitDelegatedFunctionCallOutput({
      callId,
      delegationId: this.pendingByCallId.get(callId)?.delegationId ?? null,
      callerTurnId: null,
      semanticDisposition: "UNKNOWN",
      output,
    });
  }

  requestDelegatedProtocolContinuation(input: {
    delegationId: string | null;
    triggerCallId: string;
    callerTurnId: string | null;
    semanticDisposition: string;
    startedAtMs?: number;
  }): void {
    if (this.sessionClosed) return;
    if (this.hasPendingFunctionOutputs()) return;

    const delegationId = input.delegationId ?? this.activeDelegationId;
    const d = delegationId ? this.delegations.get(delegationId) : null;
    const barrierGen = d?.protocolBarrierGeneration ?? this.protocolBarrierGenerationGlobal;
    const barrierKey = `${delegationId ?? "none"}:${barrierGen}`;
    if (this.delegatedProtocolContinuationSent.has(barrierKey)) {
      return;
    }
    this.delegatedProtocolContinuationSent.add(barrierKey);
    if (d) {
      d.protocolBarrierGeneration += 1;
    } else {
      this.protocolBarrierGenerationGlobal += 1;
    }

    const eventId = `voice_v3_delegated_cont_${this.liveSessionId}_${input.triggerCallId}_${Date.now()}`;
    if (d) {
      d.lastContinuationEventId = eventId;
      if (d.phase === "TOOL_OUTPUT_SUBMITTED") {
        d.phase = "CONTINUING";
      }
    }

    const delegationStale = delegationId
      ? this.isDelegationSemanticallyStale(delegationId)
      : false;
    if (delegationStale) {
      console.log("STALE_DELEGATION_PROTOCOL_CONTINUED", {
        live_session_id: this.liveSessionId,
        delegation_id: delegationId,
        call_id: input.triggerCallId,
        current_conversation_revision: getCurrentConversationRevision(this.liveSessionId),
        based_on_conversation_revision:
          this.getDelegationRuntime(delegationId)?.basedOnConversationRevision ?? null,
        note: "protocol_completion_not_semantic_authorization",
      });
    }

    console.log("DELEGATED_CONTINUATION_REQUESTED", {
      live_session_id: this.liveSessionId,
      call_id: input.triggerCallId,
      function_call_id: input.triggerCallId,
      delegation_id: delegationId,
      caller_turn_id: input.callerTurnId,
      semantic_disposition: input.semanticDisposition,
      delegation_semantically_stale: delegationStale,
      pending_output_count: 0,
      event_id: eventId,
      elapsed_ms: input.startedAtMs ? Date.now() - input.startedAtMs : null,
    });

    logVoiceV3Pipeline("live_out", "response.create", {
      live_session_id: this.liveSessionId,
      reason: "delegated_protocol_continuation",
      event_id: eventId,
      delegation_id: delegationId,
    });

    this.send({
      type: "response.create",
      event_id: eventId,
    });
    if (input.callerTurnId) {
      noteTurnDelegationContinued(this.liveSessionId, input.callerTurnId);
    }
    noteSemanticTimingEvent(this.liveSessionId, "responseCreateRequestedAt");
    noteSemanticTimingEvent(this.liveSessionId, "responseCreateCount");
    noteSemanticTimingEvent(this.liveSessionId, "delegatedContinuationRequestedAt");
  }

  requestResponseCreate(input: {
    reason: string;
    eventId?: string;
    stateVersion?: number;
    actionKey?: string;
    /** Initial greeting before any delegation exists */
    allowBeforeDelegation?: boolean;
  }): void {
    const allowedConversational =
      input.allowBeforeDelegation === true || input.reason === "initial_greeting";
    if (!allowedConversational) {
      console.log("LIVE_CONVERSATIONAL_RESPONSE_CREATE_BLOCKED", {
        live_session_id: this.liveSessionId,
        reason: input.reason,
        hint: "GPT-Live owns conversation; app response.create is protocol-only",
      });
      return;
    }

    if (this.sessionClosed) {
      console.log("LIVE_RESPONSE_SUPERSEDED", {
        live_session_id: this.liveSessionId,
        reason: input.reason,
        supersede_reason: "session_closed",
      });
      return;
    }

    const actionKey = input.actionKey ?? input.reason;
    const speakRequestId = input.eventId ?? `speak_${this.liveSessionId}_${Date.now()}`;
    const dedupeKey = `${input.stateVersion ?? "na"}:${actionKey}`;
    if (this.sentSpeakKeys.has(dedupeKey)) {
      console.log("LIVE_RESPONSE_SUPERSEDED", {
        live_session_id: this.liveSessionId,
        reason: input.reason,
        supersede_reason: "duplicate_action_key",
        action_key: actionKey,
      });
      return;
    }

    const hasDelegation = this.delegations.size > 0 || this.activeDelegationId !== null;
    if (this.hasPendingFunctionOutputs() || this.hasOpenDelegationAwaitingTool()) {
      this.registerSpeakRequest(speakRequestId, input, "QUEUED");
      this.enqueueContinuation({ ...input, eventId: speakRequestId });
      logVoiceV3Pipeline("live_out", "response.create.queued", {
        live_session_id: this.liveSessionId,
        reason: input.reason,
        pending_function_calls: this.pendingOutstandingCount(),
      });
      return;
    }

    if (hasDelegation && !input.allowBeforeDelegation) {
      // Still safe — no pending outputs
    }

    this.registerSpeakRequest(speakRequestId, { ...input, eventId: speakRequestId }, "QUEUED");
    this.flushContinuation({ ...input, eventId: speakRequestId });
  }

  markSessionClosed(): void {
    this.sessionClosed = true;
    this.continuationQueue = [];
    for (const req of this.speakRequests.values()) {
      if (req.status === "QUEUED") {
        req.status = "CANCELLED";
      }
    }
    console.log("LIVE_SPEAK_CANCELLED_SESSION_CLOSED", {
      live_session_id: this.liveSessionId,
      queued_cancelled: this.speakRequests.size,
    });
  }

  supersedeStaleSpeaks(input: {
    minStateVersion: number;
    exceptActionKeys?: string[];
  }): void {
    const except = new Set(input.exceptActionKeys ?? []);
    this.continuationQueue = this.continuationQueue.filter((req) => {
      if (req.stateVersion == null) return true;
      if (req.stateVersion >= input.minStateVersion) return true;
      if (except.has(req.actionKey ?? req.reason)) return true;
      console.log("LIVE_RESPONSE_SUPERSEDED", {
        live_session_id: this.liveSessionId,
        reason: req.reason,
        supersede_reason: "stale_state_version",
        state_version: req.stateVersion,
      });
      return false;
    });
    for (const req of this.speakRequests.values()) {
      if (req.status !== "QUEUED") continue;
      if (req.stateVersion == null || req.stateVersion >= input.minStateVersion) continue;
      if (except.has(req.actionKey)) continue;
      req.status = "SUPERSEDED";
    }
  }

  private registerSpeakRequest(
    speakRequestId: string,
    input: ContinuationRequest,
    status: LiveSpeakRequestStatus,
  ): void {
    this.speakRequests.set(speakRequestId, {
      speakRequestId,
      stateVersion: input.stateVersion,
      actionKey: input.actionKey ?? input.reason,
      sessionEpoch: this.sessionEpoch,
      status,
      reason: input.reason,
    });
  }

  private pendingOutstandingCount(): number {
    let n = 0;
    for (const row of this.pendingByCallId.values()) {
      if (!row.outputSubmitted) n += 1;
    }
    return n;
  }

  private enqueueContinuation(req: ContinuationRequest): void {
    const key = `${req.reason}:${req.eventId ?? ""}`;
    const exists = this.continuationQueue.some(
      (r) => `${r.reason}:${r.eventId ?? ""}` === key,
    );
    if (!exists) {
      this.continuationQueue.push(req);
    }
  }

  private scheduleContinuationFlush(): void {
    if (this.continuationFlushScheduled) return;
    this.continuationFlushScheduled = true;
    queueMicrotask(() => {
      this.continuationFlushScheduled = false;
      if (this.hasPendingFunctionOutputs()) return;
      const next = this.continuationQueue.shift();
      if (next) {
        this.flushContinuation(next);
        if (this.continuationQueue.length > 0) {
          this.scheduleContinuationFlush();
        }
      }
    });
  }

  private flushContinuation(input: ContinuationRequest): void {
    if (this.sessionClosed) {
      console.log("LIVE_RESPONSE_SUPERSEDED", {
        live_session_id: this.liveSessionId,
        reason: input.reason,
        supersede_reason: "session_closed_flush",
      });
      return;
    }

    const eventId =
      input.eventId ??
      `voice_v3_speak_${input.reason}_${this.liveSessionId}_${Date.now()}`;

    const actionKey = input.actionKey ?? input.reason;
    const dedupeKey = `${input.stateVersion ?? "na"}:${actionKey}`;
    if (this.sentSpeakKeys.has(dedupeKey)) {
      console.log("LIVE_RESPONSE_SUPERSEDED", {
        live_session_id: this.liveSessionId,
        reason: input.reason,
        supersede_reason: "duplicate_action_key_flush",
      });
      return;
    }
    this.sentSpeakKeys.add(dedupeKey);

    const row = this.speakRequests.get(eventId);
    if (row) {
      row.status = "SENT";
    } else {
      this.registerSpeakRequest(eventId, input, "SENT");
    }

    logVoiceV3Pipeline("live_out", "response.create", {
      live_session_id: this.liveSessionId,
      reason: input.reason,
      event_id: eventId,
    });

    console.log("LIVE_RESPONSE_CREATE_REQUESTED", {
      live_session_id: this.liveSessionId,
      reason: input.reason,
      event_id: eventId,
    });

    this.send({
      type: "response.create",
      event_id: eventId,
    });
    noteSemanticTimingEvent(this.liveSessionId, "responseCreateRequestedAt");
    noteSemanticTimingEvent(this.liveSessionId, "responseCreateCount");
    noteSemanticTimingEvent(this.liveSessionId, "delegatedContinuationRequestedAt");

    if (this.activeDelegationId) {
      const d = this.delegations.get(this.activeDelegationId);
      if (d && d.phase === "TOOL_OUTPUT_SUBMITTED") {
        d.phase = "CONTINUING";
      }
    }
  }

  clear(): void {
    this.markSessionClosed();
    this.delegations.clear();
    this.pendingByCallId.clear();
    this.continuationQueue = [];
    this.activeDelegationId = null;
    this.speakRequests.clear();
    this.sentSpeakKeys.clear();
    this.delegatedProtocolContinuationSent.clear();
    this.sessionEpoch += 1;
  }

  /** Test-only: count protocol continuations sent. */
  delegatedProtocolContinuationCount(): number {
    return this.delegatedProtocolContinuationSent.size;
  }
}

const coordinators = new Map<string, VoiceV3LiveResponseCoordinator>();

export function getVoiceV3LiveResponseCoordinator(
  liveSessionId: string,
  send: LiveSidebandSend,
): VoiceV3LiveResponseCoordinator {
  const id = liveSessionId.trim();
  let coord = coordinators.get(id);
  if (!coord) {
    coord = new VoiceV3LiveResponseCoordinator(id, send);
    coordinators.set(id, coord);
  } else {
    coord.updateSend(send);
  }
  return coord;
}

export function clearVoiceV3LiveResponseCoordinator(liveSessionId: string): void {
  const id = liveSessionId.trim();
  coordinators.get(id)?.clear();
  coordinators.delete(id);
}

/** Test-only */
export function peekVoiceV3LiveResponseCoordinator(
  liveSessionId: string,
): VoiceV3LiveResponseCoordinator | null {
  return coordinators.get(liveSessionId.trim()) ?? null;
}
