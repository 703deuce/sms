/**
 * Application confirmation policy (Phase 11) — enforced in tool executors, not by Astra alone.
 */

export type ConfirmationAction =
  | "UPDATE_INTAKE"
  | "BOOK"
  | "RESCHEDULE"
  | "CANCEL"
  | "TRANSFER"
  | "END_CALL";

export const CONFIRMATION_POLICY: Record<
  ConfirmationAction,
  { requiresExplicitConfirmation: boolean; notes: string }
> = {
  UPDATE_INTAKE: {
    requiresExplicitConfirmation: false,
    notes: "Persist clear caller-provided intake values; corrections supersede prior values.",
  },
  BOOK: {
    requiresExplicitConfirmation: false,
    notes: "Caller must clearly select/accept a slot from the current offer set (enforced via slot_id validation).",
  },
  RESCHEDULE: {
    requiresExplicitConfirmation: false,
    notes: "Verified appointment + valid replacement slot from current offer set required.",
  },
  CANCEL: {
    requiresExplicitConfirmation: true,
    notes: "cancel_appointment requires confirmed=true after explicit caller confirmation.",
  },
  TRANSFER: {
    requiresExplicitConfirmation: false,
    notes: "Caller request or configured escalation; destination must be configured.",
  },
  END_CALL: {
    requiresExplicitConfirmation: false,
    notes: "Conversational completion; end_call is lifecycle signal only.",
  },
};
