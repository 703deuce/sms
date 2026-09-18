import type { LiveSidebandSend } from "../greeting";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { noteSemanticTimingEvent } from "../telemetry/caller-turn-timing";
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

  constructor(liveSessionId: string, send: LiveSidebandSend) {
    this.liveSessionId = liveSessionId.trim();
    this.send = send;
  }

  updateSend(send: LiveSidebandSend): void {
    this.send = send;
  }

  onDelegationCreated(delegation: { id?: string; response_id?: string }): void {
    const delegationId = typeof delegation.id === "string" ? delegation.id : null;
    if (!delegationId) return;

    this.activeDelegationId = delegationId;
    const existing = this.delegations.get(delegationId);
    if (!existing) {
      this.delegations.set(delegationId, {
        delegationId,
        responseId: delegation.response_id,
        phase: "STARTED",
        pendingFunctionCalls: new Map(),
        submittedFunctionCallIds: new Set(),
      });
    }
    logVoiceV3Pipeline("live_out", "delegation.registered", {
      live_session_id: this.liveSessionId,
      delegation_id: delegationId,
    });
    noteSemanticTimingEvent(this.liveSessionId, "delegationCreatedAt");
    noteSemanticTimingEvent(this.liveSessionId, "delegationCount");
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
          phase: "AWAITING_TOOL_OUTPUT",
          pendingFunctionCalls: new Map(),
          submittedFunctionCallIds: new Set(),
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

    if (nestedType === "response.completed") {
      if (id) {
        const d = this.delegations.get(id);
        if (d) d.phase = "COMPLETED";
      }
      logVoiceV3Pipeline("live_out", "delegation.completed", {
        live_session_id: this.liveSessionId,
        delegation_id: id,
      });
      console.log("ASTRA_DELEGATION_COMPLETED", {
        live_session_id: this.liveSessionId,
        delegation_id: id,
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

  submitFunctionCallOutput(
    callId: string,
    output: Record<string, unknown>,
    options?: { skipScheduleContinuation?: boolean },
  ): boolean {
    const row = this.pendingByCallId.get(callId);
    if (!row || row.outputSubmitted) {
      return false;
    }

    row.outputSubmitted = true;
    const eventId = `voice_v3_fn_out_${this.liveSessionId}_${callId}_${Date.now()}`;
    const payload = {
      type: "response.item.create",
      event_id: eventId,
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(output),
      },
    };

    logVoiceV3Pipeline("live_out", "response.item.create", {
      live_session_id: this.liveSessionId,
      call_id: callId,
      event_id: eventId,
      name: row.name,
    });

    console.log("LIVE_FUNCTION_CALL_OUTPUT_SUBMITTED", {
      live_session_id: this.liveSessionId,
      call_id: callId,
      name: row.name,
      delegation_id: row.delegationId,
    });

    this.send(payload);

    if (row.delegationId) {
      const d = this.delegations.get(row.delegationId);
      if (d) {
        d.submittedFunctionCallIds.add(callId);
        const pendingLeft = [...d.pendingFunctionCalls.values()].some((c) => !c.outputSubmitted);
        if (!pendingLeft) {
          d.phase = "TOOL_OUTPUT_SUBMITTED";
        }
      }
    }

    if (!options?.skipScheduleContinuation) {
      this.scheduleContinuationFlush();
    }
    return true;
  }

  requestResponseCreate(input: {
    reason: string;
    eventId?: string;
    stateVersion?: number;
    actionKey?: string;
    /** Initial greeting before any delegation exists */
    allowBeforeDelegation?: boolean;
  }): void {
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
    this.sessionEpoch += 1;
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
