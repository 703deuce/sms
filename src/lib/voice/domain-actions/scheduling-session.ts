import { getSessionRuntimeExt, patchSessionRuntimeExt } from "@/lib/voice/session-runtime/state";
import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import type { LiveKitCallContext } from "./session-bootstrap";
import { buildHeldSlotPayload, buildSlotsPayload } from "./tool-results";

function normalizeSlotIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const str = String(value ?? "").trim();
  if (!str) return "";
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? str : d.toISOString();
}

function extractSlotsFromWorkflowResult(result: Record<string, unknown>): string[] {
  const data = (result.data || {}) as Record<string, unknown>;
  const raw = Array.isArray(data.slots) ? data.slots : [];
  return raw
    .map((slot) => {
      if (typeof slot === "string") return normalizeSlotIso(slot);
      const row = slot as Record<string, unknown>;
      return normalizeSlotIso(row.slotId || row.start || row.startsAt || row.start_time);
    })
    .filter(Boolean);
}

/**
 * LiveKit keeps a hot in-memory session cache. Scheduling tools mutate durable runtime/DB
 * state — reload + patch so tool results and agent sync see real slots/holds/bookings.
 */
export async function reloadLiveKitSchedulingSession(
  ctx: LiveKitCallContext,
  result: Record<string, unknown>,
): Promise<AmyRealtimeSession> {
  const workflowState = String(result.workflow_state || ctx.session.currentState) as WorkflowState;
  const resultSlots = extractSlotsFromWorkflowResult(result);
  const data = (result.data || {}) as Record<string, unknown>;
  const heldFromResult =
    typeof data.selected_slot === "string"
      ? data.selected_slot
      : typeof (data.heldSlot as { start?: string } | undefined)?.start === "string"
        ? (data.heldSlot as { start: string }).start
        : null;

  const preservedExt = getSessionRuntimeExt(input.ctx.session);
  const preservedNodeId = input.ctx.session.currentNodeId;
  const preservedCollected = { ...input.ctx.session.collectedFields };

  let session = await reloadRealtimeSession({
    callId: ctx.callId,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
    workflow: ctx.session.workflowId,
    serviceName: ctx.session.serviceName,
  });

  const availableSlots =
    resultSlots.length > 0
      ? resultSlots
      : session.availableSlots.length > 0
        ? session.availableSlots
        : session.runtime.proposed_slots.map(normalizeSlotIso).filter(Boolean);

  session = await updateSessionAfterRuntimeChange(session, {
    currentState: workflowState,
    availableSlots,
    heldSlot: heldFromResult || session.heldSlot || session.runtime.held_slot || null,
    selectedSlot:
      heldFromResult || session.selectedSlot || session.runtime.selected_slot || null,
    bookingId: session.bookingId || session.runtime.booking_id || null,
    lastRuntimeResult: result,
    runtime: session.runtime,
  });

  ctx.session = session;
  ctx.workflowState = session.currentState;
  return session;
}

export function slotsForToolResult(
  session: AmyRealtimeSession,
  result: Record<string, unknown>,
): ReturnType<typeof buildSlotsPayload> {
  const fromResult = extractSlotsFromWorkflowResult(result);
  if (fromResult.length > 0) {
    return fromResult.map((start) => ({
      slotId: start,
      start,
      spokenLabel: buildSlotsPayload({
        ...session,
        availableSlots: fromResult,
      }).find((slot) => slot.start === start)?.spokenLabel || start,
    }));
  }
  return buildSlotsPayload(session);
}

export async function traceLiveKitDomainAction(
  ctx: LiveKitCallContext,
  tool: string,
  result: {
    ok: boolean;
    speak?: string;
    workflow_state?: string;
    error_code?: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  const { appendTraceEvent } = await import("@/lib/voice/workflow-engine/trace");
  await appendTraceEvent(ctx.callId, {
    kind: "livekit_tool",
    tool,
    workflow_state: result.workflow_state || ctx.session.currentState,
    detail: {
      ok: result.ok,
      error_code: result.error_code,
      slot_count: Array.isArray(result.data?.slots) ? result.data?.slots.length : undefined,
      next_action: result.data?.nextAction,
      workflow_state: result.workflow_state,
    },
  }).catch(() => undefined);
}

/** @deprecated use reloadLiveKitSchedulingSession — kept for tests comparing old behavior */
export async function staleCachedSessionOnly(ctx: LiveKitCallContext): Promise<AmyRealtimeSession> {
  return getOrCreateRealtimeSession({
    callId: ctx.callId,
    workspaceId: ctx.workspaceId,
    agentId: ctx.agentId,
  });
}

export { buildHeldSlotPayload };
