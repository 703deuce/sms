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

type BookingTurnLog = (event: string, extra?: Record<string, unknown>) => void;

type BookingSlotTurnDeps = {
  log: BookingTurnLog;
  commitBooking: (session: AgentSession<FrontDeskUserData>) => Promise<void>;
};

/**
 * Runtime-owned slot pick + confirm after availability is offered.
 * final transcript → match slot → confirm prompt → yes → commit.
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
      log("booking_confirm_accepted", { transcript: normalized });
      await deps.commitBooking(session);
      return;
    }

    if (utteranceIndicatesBookingRejection(normalized)) {
      log("booking_confirm_rejected", { transcript: normalized });
      ud.pendingSlotId = undefined;
      setWorkflowState(ud, "BOOKING_AWAIT_SLOT");
      await controlledGenerateReply(session, "booking_slot_rejected", bumpCollectionTurnSeq(ud), {
        instructions:
          "The caller does not want that time. Ask exactly one question: which of the offered times works for them?",
        toolChoice: "none",
      });
      return;
    }

    const rematch = matchOfferedSlotFromUtterance(
      normalized,
      offered,
      slotsMap,
      ud.timezone,
    );
    if (rematch) {
      ud.pendingSlotId = rematch.slotId;
      const label = formatSlotSpokenLabel(rematch, ud.timezone);
      log("booking_slot_rematched", { slotId: rematch.slotId, label });
      await controlledGenerateReply(session, "booking_confirm_reprompt", bumpCollectionTurnSeq(ud), {
        instructions: `Confirm the new time in one short sentence: ${label}. Ask exactly one yes-or-no question to book it.`,
        toolChoice: "none",
      });
      return;
    }

    log("booking_confirm_unclear", { transcript: normalized });
    const pending = ud.pendingSlotId ? slotsMap.get(ud.pendingSlotId) : undefined;
    const label = pending ? formatSlotSpokenLabel(pending, ud.timezone) : "that time";
    await controlledGenerateReply(session, "booking_confirm_unclear", bumpCollectionTurnSeq(ud), {
      instructions:
        `The caller said "${normalized}" but did not clearly confirm ${label}. ` +
        "Ask one short yes-or-no question: should I book that time?",
      toolChoice: "none",
    });
    return;
  }

  if (wf.state !== "BOOKING_OFFER_SLOTS" && wf.state !== "BOOKING_AWAIT_SLOT") return;

  const matched = matchOfferedSlotFromUtterance(normalized, offered, slotsMap, ud.timezone);
  if (matched) {
    ud.pendingSlotId = matched.slotId;
    setWorkflowState(ud, "BOOKING_CONFIRM_SLOT");
    const label = formatSlotSpokenLabel(matched, ud.timezone);
    log("booking_slot_matched", { slotId: matched.slotId, label, transcript: normalized });
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
