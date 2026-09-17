import "server-only";

import type {
  CallerInterpretationResult,
  CallerMeaning,
  InterpreterContext,
} from "@/lib/voice-v2/caller-meaning";

export type VoiceV2TestAstraMode = "success" | "timeout" | "fail" | "null";

let testMode: VoiceV2TestAstraMode | null = null;
let successMeaningFactory: ((ctx: InterpreterContext) => CallerMeaning) | null = null;
let timeoutDelayMs = 50;

export function setVoiceV2TestAstraMode(
  mode: VoiceV2TestAstraMode | null,
  opts?: { successMeaning?: (ctx: InterpreterContext) => CallerMeaning; timeoutMs?: number },
): void {
  testMode = mode;
  successMeaningFactory = opts?.successMeaning ?? null;
  if (opts?.timeoutMs != null) timeoutDelayMs = opts.timeoutMs;
}

export function getVoiceV2TestAstraMode(): VoiceV2TestAstraMode | null {
  if (process.env.VOICE_V2_TEST_ASTRA_MOCK?.trim()) {
    const v = process.env.VOICE_V2_TEST_ASTRA_MOCK.trim().toLowerCase();
    if (v === "success" || v === "timeout" || v === "fail" || v === "null") {
      return v;
    }
  }
  return testMode;
}

/**
 * When VOICE_V2_ASTRA_INTERPRETER=1 and test mode is set, bypasses live OpenAI for harness tests.
 */
export async function runVoiceV2TestAstraMock(
  ctx: InterpreterContext,
): Promise<CallerInterpretationResult | null> {
  const mode = getVoiceV2TestAstraMode();
  if (!mode) return null;

  if (mode === "fail" || mode === "null") {
    return null;
  }

  if (mode === "timeout") {
    await new Promise((r) => setTimeout(r, timeoutDelayMs));
    throw new Error("astra_interpreter_timeout");
  }

  const meaning =
    successMeaningFactory?.(ctx) ??
    ({
      active_goal: "BOOK_APPOINTMENT",
      facts: {
        requested_date: null,
        requested_daypart: null,
        requested_time: null,
        selected_slot_spoken_label: null,
        selected_slot_ordinal: null,
        selected_slot_id: null,
      },
      corrections: [],
      explicit_action_requests: ["BOOK_APPOINTMENT"],
      ambiguities: [],
      confidence: 0.9,
      digression: false,
      evidence: ctx.stable.text,
    } satisfies CallerMeaning);

  return {
    meaning,
    implementationId: "astra_test_mock",
    latencyMs: 1,
    mergePolicy: "full",
  };
}

export function resetVoiceV2TestAstraHook(): void {
  testMode = null;
  successMeaningFactory = null;
  timeoutDelayMs = 50;
}
