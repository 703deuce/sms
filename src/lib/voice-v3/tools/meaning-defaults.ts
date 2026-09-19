import type { CallerMeaning } from "../intake/caller-meaning-schema";
import { emptySlotSelectionMeaning } from "../intake/slot-selection-schema";
import { emptyAppointmentSelectionMeaning } from "../intake/appointment-selection-schema";
import { emptySchedulingMeaning } from "../time/scheduling-types";

export function emptyCallerMeaningBase(): CallerMeaning {
  return {
    active_goal: "UNKNOWN",
    goals: [],
    captured_fields: [],
    scheduling: emptySchedulingMeaning(),
    corrections: [],
    ambiguities: [],
    slot_selection: emptySlotSelectionMeaning(),
    post_book_intent: "NONE",
    appointment_selection: emptyAppointmentSelectionMeaning(),
    cancellation_confirmation: "NONE",
  };
}
