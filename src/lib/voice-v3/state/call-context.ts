import type { VoiceV3CallClock } from "../time/call-clock";
import type { AvailabilityOfferSet } from "../calendar/offer-set";
import type { PresentedOffer, SelectedAvailabilitySlot } from "../calendar/selected-slot";
import type { FindAvailabilityFailure, FindAvailabilityStatus } from "../calendar/types";
import type { SlotSelectionResolution } from "../calendar/resolve-slot-selection";
import type { SchedulingClarificationRequirement } from "../time/scheduling-clarification";
import type {
  NormalizedSchedulingPreference,
  SchedulingMeaning,
} from "../time/scheduling-types";

export type VoiceV3Goal =
  | "UNKNOWN"
  | "GENERAL"
  | "BOOK_APPOINTMENT"
  | "REQUEST_CALLBACK"
  | "REQUEST_TRANSFER";

export interface CapturedField {
  value: string;
  source: "caller" | "business" | "runtime";
  confidence?: number;
  utteranceId?: string;
  updatedAt: string;
}

export interface VoiceV3CallContext {
  callId: string;
  liveSessionId: string;
  createdAt: string;
  updatedAt: string;
  business: {
    timezone: string;
  };
  clock: VoiceV3CallClock;
  dialog: {
    activeGoal: VoiceV3Goal;
  };
  intake: {
    values: Record<string, CapturedField>;
  };
  scheduling: {
    generation: number;
    meaning?: SchedulingMeaning;
    normalized?: NormalizedSchedulingPreference | null;
    clarification?: SchedulingClarificationRequirement | null;
  };
  availability: {
    status: FindAvailabilityStatus;
    activeOfferSet: AvailabilityOfferSet | null;
    lastFailure: FindAvailabilityFailure | null;
    inFlightGeneration: number | null;
    lastDispatchedRequestKey: string | null;
  };
  presentation: {
    current: PresentedOffer | null;
  };
  selection: {
    selected: SelectedAvailabilitySlot | null;
    lastResolutionStatus: SlotSelectionResolution["status"] | null;
  };
  runtime: {
    version: number;
  };
}

export function createInitialVoiceV3CallContext(input: {
  callId: string;
  liveSessionId: string;
  timezone: string;
  clock: VoiceV3CallClock;
  now?: Date;
}): VoiceV3CallContext {
  const now = (input.now ?? new Date()).toISOString();
  return {
    callId: input.callId,
    liveSessionId: input.liveSessionId,
    createdAt: now,
    updatedAt: now,
    business: { timezone: input.timezone },
    clock: input.clock,
    dialog: { activeGoal: "UNKNOWN" },
    intake: { values: {} },
    scheduling: { generation: 0, normalized: null },
    availability: {
      status: "idle",
      activeOfferSet: null,
      lastFailure: null,
      inFlightGeneration: null,
      lastDispatchedRequestKey: null,
    },
    presentation: { current: null },
    selection: { selected: null, lastResolutionStatus: null },
    runtime: { version: 0 },
  };
}
