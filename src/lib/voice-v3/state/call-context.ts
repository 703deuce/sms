import type { VoiceV3CallClock } from "../time/call-clock";
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
    runtime: { version: 0 },
  };
}
