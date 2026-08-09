import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { AgentRuntimeRecord } from "@/lib/voice/workflow-engine/types";
import { appendFieldReceipt } from "@/lib/voice/workflow-engine/runtime-state";
import type {
  ClassificationMap,
  EligibilityResult,
  HeldReservation,
  SessionRuntimeExtensions,
  SlotRef,
  TransferState,
} from "./types";

const EXT_KEY = "sessionRuntime" as const;

function readExt(runtime: AgentRuntimeRecord): SessionRuntimeExtensions {
  const raw = (runtime as AgentRuntimeRecord & { session_runtime?: SessionRuntimeExtensions })
    .session_runtime;
  return raw || {};
}

function writeExt(
  runtime: AgentRuntimeRecord,
  ext: SessionRuntimeExtensions,
): AgentRuntimeRecord {
  return { ...runtime, session_runtime: ext } as AgentRuntimeRecord;
}

export function getSessionRuntimeExt(session: AmyRealtimeSession): SessionRuntimeExtensions {
  return readExt(session.runtime);
}

export function patchSessionRuntimeExt(
  session: AmyRealtimeSession,
  patch: Partial<SessionRuntimeExtensions>,
): AmyRealtimeSession {
  const ext = { ...readExt(session.runtime), ...patch };
  const runtime = writeExt(session.runtime, ext);
  return { ...session, runtime };
}

export function syncFieldReceiptToSession(
  session: AmyRealtimeSession,
  fieldId: string,
  value: string,
): AmyRealtimeSession {
  const runtime = appendFieldReceipt(session.runtime, fieldId, value);
  return { ...session, runtime };
}

export function setHeldReservation(
  session: AmyRealtimeSession,
  reservation: HeldReservation | null,
): AmyRealtimeSession {
  const runtime: AgentRuntimeRecord = {
    ...session.runtime,
    held_slot: reservation?.start || null,
    selected_slot: reservation?.start || session.runtime.selected_slot,
  };
  return patchSessionRuntimeExt(
    { ...session, runtime, heldSlot: reservation?.start || null, selectedSlot: reservation?.start || session.selectedSlot },
    { heldReservation: reservation },
  );
}

export function getHeldReservation(session: AmyRealtimeSession): HeldReservation | null {
  return getSessionRuntimeExt(session).heldReservation || null;
}

export function setProposedSlotRefs(
  session: AmyRealtimeSession,
  slots: SlotRef[],
): AmyRealtimeSession {
  const isoSlots = slots.map((s) => s.start);
  const runtime: AgentRuntimeRecord = {
    ...session.runtime,
    proposed_slots: isoSlots,
  };
  return patchSessionRuntimeExt(
    { ...session, runtime, availableSlots: isoSlots },
    { proposedSlotRefs: slots },
  );
}

export function getProposedSlotRefs(session: AmyRealtimeSession): SlotRef[] {
  const ext = getSessionRuntimeExt(session);
  if (ext.proposedSlotRefs?.length) return ext.proposedSlotRefs;
  return (session.availableSlots || []).map((start) => ({
    slotId: start,
    start,
  }));
}

export function setClassifications(
  session: AmyRealtimeSession,
  classifications: ClassificationMap,
): AmyRealtimeSession {
  return patchSessionRuntimeExt(session, { classifications });
}

export function setEligibility(
  session: AmyRealtimeSession,
  eligibility: EligibilityResult | null,
): AmyRealtimeSession {
  return patchSessionRuntimeExt(session, { eligibility });
}

export function setTransferState(
  session: AmyRealtimeSession,
  transfer: TransferState,
): AmyRealtimeSession {
  return patchSessionRuntimeExt(session, { transfer });
}

export function setCurrentTask(
  session: AmyRealtimeSession,
  task: string | null,
): AmyRealtimeSession {
  return patchSessionRuntimeExt(session, { currentTask: task });
}

export function invalidateSchedulingState(
  session: AmyRealtimeSession,
  reason?: string,
): AmyRealtimeSession {
  const runtime: AgentRuntimeRecord = {
    ...session.runtime,
    proposed_slots: [],
    held_slot: null,
    selected_slot: null,
  };
  return patchSessionRuntimeExt(
    {
      ...session,
      runtime,
      availableSlots: [],
      heldSlot: null,
      selectedSlot: null,
      currentState:
        session.missingFieldIds.length > 0 ? "COLLECTING_FIELDS" : "CHECKING_AVAILABILITY",
    },
    {
      heldReservation: null,
      proposedSlotRefs: [],
      schedulingInvalidationFields: reason ? [reason] : [],
    },
  );
}

export function shouldReuseHold(
  session: AmyRealtimeSession,
  startsAt: string,
): HeldReservation | null {
  const held = getHeldReservation(session);
  if (!held || held.status !== "held") return null;
  if (held.start !== startsAt) return null;
  if (held.expiresAt && new Date(held.expiresAt).getTime() < Date.now()) return null;
  return held;
}
