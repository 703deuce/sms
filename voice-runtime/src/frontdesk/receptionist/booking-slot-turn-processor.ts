import type { AgentSession } from "@livekit/agents";
import type { FrontDeskUserData } from "../userdata";
import { ensureReceptionistWorkflow, setWorkflowState } from "./workflow-engine";
import {
  formatSlotSpokenLabel,
  matchOfferedSlotFromUtterance,
  utteranceIndicatesBookingConfirmation,
  utteranceIndicatesBookingRejection,
  utteranceLooksLikeSlotSelection,
} from "./booking-slot-turn";
import {
  bumpCollectionTurnSeq,
  controlledGenerateReply,
} from "./collection-realtime-control";

type BookingSlotTurnDeps = {
  log: (event: string, extra?: Record<string, unknown>) => void;
  commitBooking: (session: AgentSession<FrontDeskUserData>) => Promise<void>;
};

function clearSelectedSlot(ud: FrontDeskUserData): void {
  ud.pendingSlotId = undefined;
  const wf = ensureReceptionistWorkflow(ud);
  wf.selectedSlotId = undefined;
}

function applySelectedSlot(ud: FrontDeskUserData, slotId: string): void {
  ud.pendingSlotId = slotId;
  const wf = ensureReceptionistWorkflow(ud);
  wf.selectedSlotId = slotId;
}

/**
 * Runtime-owned slot pick + confirm:
 * SELECT_SLOT → CONFIRM_SLOT → COMMIT (via deps.commitBooking).
 */
export async function processBookingSlotTurn(
  session: AgentSession<FrontDeskUserData>,
  transcript: string,
  deps: BookingSlotTurnDeps,
): Promise<void> {
  const log = deps.log;
  const ud = session.userData;
  const wf = ensureReceptionistWorkflow(ud);
  const normalized = transcript.trim();
  if (!normalized) return;

  const offered = wf.offeredSlotIds ?? [];
  const slotsMap = ud.receptionistSlotsMap;
  if (!slotsMap || offered.length === 0) return;

  if (wf.state === "BOOKING_CONFIRM_SLOT") {
    if (utteranceIndicatesBookingConfirmation(normalized)) {
      const selected = wf.selectedSlotId || ud.pendingSlotId;
      if (!selected || !offered.includes(selected)) {
        log("booking_confirm_invalid_selection", { selected, offered });
        clearSelectedSlot(ud);
        setWorkflowState(ud, "BOOKING_SELECT_SLOT");
        return;
      }
      log("booking_confirm_accepted", { transcript: normalized, selectedSlotId: selected });
      setWorkflowState(ud, "BOOKING_COMMIT");
      await deps.commitBooking(session);
      return;
    }

    if (utteranceIndicatesBookingRejection(normalized)) {
      log("booking_confirm_rejected", { transcript: normalized });
      clearSelectedSlot(ud);
      setWorkflowState(ud, "BOOKING_SELECT_SLOT");
      await controlledGenerateReply(session, "booking_slot_rejected", bumpCollectionTurnSeq(ud), {
        instructions:
          "The caller does not want that time. Ask exactly one question: which of the offered times works for them?",
        toolChoice: "none",
      });
      return;
    }

    const rematch = matchOfferedSlotFromUtterance(normalized, offered, slotsMap, ud.timezone);
    if (rematch && offered.includes(rematch.slotId)) {
      applySelectedSlot(ud, rematch.slotId);
      const label = formatSlotSpokenLabel(rematch, ud.timezone);
      log("booking_slot_rematched", { slotId: rematch.slotId, label });
      await controlledGenerateReply(session, "booking_confirm_reprompt", bumpCollectionTurnSeq(ud), {
        instructions: `Confirm the new time in one short sentence: ${label}. Ask exactly one yes-or-no question to book it.`,
        toolChoice: "none",
      });
      return;
    }

    log("booking_confirm_unclear", { transcript: normalized });
    const pending = wf.selectedSlotId ? slotsMap.get(wf.selectedSlotId) : undefined;
    const label = pending ? formatSlotSpokenLabel(pending, ud.timezone) : "that time";
    await controlledGenerateReply(session, "booking_confirm_unclear", bumpCollectionTurnSeq(ud), {
      instructions:
        `The caller said "${normalized}" but did not clearly confirm ${label}. ` +
        "Ask one short yes-or-no question: should I book that time?",
      toolChoice: "none",
    });
    return;
  }

  if (wf.state !== "BOOKING_SELECT_SLOT") return;

  const matched = matchOfferedSlotFromUtterance(normalized, offered, slotsMap, ud.timezone);
  if (matched && offered.includes(matched.slotId)) {
    applySelectedSlot(ud, matched.slotId);
    setWorkflowState(ud, "BOOKING_CONFIRM_SLOT", { selectedSlotId: matched.slotId });
    const label = formatSlotSpokenLabel(matched, ud.timezone);
    log("booking_slot_selected", { slotId: matched.slotId, label, transcript: normalized });
    await controlledGenerateReply(session, "booking_confirm_prompt", bumpCollectionTurnSeq(ud), {
      instructions:
        `The caller chose ${label}. Confirm in one short sentence and ask exactly one yes-or-no question to book it.`,
      toolChoice: "none",
    });
    return;
  }

  if (utteranceLooksLikeSlotSelection(normalized)) {
    log("booking_slot_unmatched", { transcript: normalized, offeredCount: offered.length });
    await controlledGenerateReply(session, "booking_slot_clarify", bumpCollectionTurnSeq(ud), {
      instructions:
        `The caller said "${normalized}" but it did not match an offered time. ` +
        "Briefly ask which of the times you offered works for them — one question only.",
      toolChoice: "none",
    });
    return;
  }

  log("booking_slot_utterance_ignored", {
    transcript: normalized,
    state: wf.state,
    reason: "not_slot_selection",
  });
}
