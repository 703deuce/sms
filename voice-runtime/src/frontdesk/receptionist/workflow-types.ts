/** Runtime-owned workflow intent — set when a caller path is activated. */
export type ReceptionistWorkflowIntent =
  | "none"
  | "booking"
  | "message"
  | "transfer"
  | "faq"
  | "general";

/** Application states the runtime conductor owns (not the model). */
export type ReceptionistWorkflowState =
  | "IDLE"
  | "BOOKING_COLLECT"
  | "BOOKING_CHECK_AVAILABILITY"
  | "BOOKING_OFFER_SLOTS"
  | "BOOKING_AWAIT_SLOT"
  | "BOOKING_CONFIRM_SLOT"
  | "BOOKING_COMMIT"
  | "BOOKING_DONE"
  | "BOOKING_FAILED"
  | "MESSAGE_COLLECT"
  | "MESSAGE_COMMIT"
  | "MESSAGE_DONE"
  | "TRANSFER_PREPARE"
  | "TRANSFER_CONNECT"
  | "TRANSFER_DONE"
  | "FAQ"
  | "END";

export type ReceptionistCollectionPurpose = "booking" | "message" | "service";

export type ReceptionistWorkflowSnapshot = {
  intent: ReceptionistWorkflowIntent;
  state: ReceptionistWorkflowState;
  /** Field the runtime is collecting when state is *_COLLECT. */
  activeFieldId?: string;
  collectionPurpose?: ReceptionistCollectionPurpose;
  /** Tool the runtime expects next (for guards + model hints). */
  requiredTool?: string;
  /** After terminal booking/message — block contradictory model turns. */
  speechLocked?: boolean;
  /** Slots offered to the caller in the current booking attempt. */
  offeredSlotIds?: string[];
  /** Monotonic turn counter for collection generation logging. */
  collectionTurnSeq?: number;
  /** Last transcript saved for the active field — dedupe double STT finalization. */
  collectionLastSavedTranscript?: string;
};

export const INITIAL_RECEPTIONIST_WORKFLOW: ReceptionistWorkflowSnapshot = {
  intent: "none",
  state: "IDLE",
};
