import type { CallerMeaning } from "../intake/caller-meaning-schema";

export type VoiceV3CallEvent =
  | {
      type: "CALLER_MEANING_APPLIED";
      meaning: CallerMeaning;
      astraLatencyMs?: number;
    }
  | { type: "RUNTIME_DISPOSED" };
