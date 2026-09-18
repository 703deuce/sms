/**
 * Live GPT + Astra messy multi-goal certification (manual / staging).
 *
 * Requires:
 *   VOICE_V3_LIVE_ASTRA_CERT=1
 *   UI_AGENT_BASE_URL or VOICE_V3_CERT_BASE_URL
 *   Live session + Astra meaning path configured for the workspace under test
 *
 * Cases (natural language — not scripted intent labels):
 *   1. Cancel tomorrow and book Friday afternoon instead.
 *   2. Start booking, change day, cancel existing first.
 *   3. Multi-field intake in one sentence.
 *   4. Caller corrects prior field.
 *   5. Goal change while FIND/BOOK in flight.
 *   6. Provider failure then new request.
 *   7. Ambiguous appointment selection.
 *   8. Conditional cancel only if replacement available (dependency between goals).
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' tsx scripts/test-voice-v3-live-astra-multi-goal-cert.ts
 */
import assert from "node:assert/strict";

const ENABLED = process.env.VOICE_V3_LIVE_ASTRA_CERT === "1";
const BASE = process.env.VOICE_V3_CERT_BASE_URL ?? process.env.UI_AGENT_BASE_URL;

export const LIVE_ASTRA_MESSY_CASES: { id: string; utterance: string; notes: string }[] = [
  {
    id: "cancel_and_book_same_sentence",
    utterance: "Cancel tomorrow and book me Friday afternoon instead.",
    notes: "Two goals one sentence; verify goal queue + operation order.",
  },
  {
    id: "conditional_cancel_with_replacement",
    utterance:
      "Actually, forget Tuesday. Cancel the one tomorrow because I can't make that either, and if you have anything Friday after lunch with Mike, do that — but don't cancel tomorrow unless you can get me something this week.",
    notes: "Cancellation contingent on replacement availability; must not blind-cancel first.",
  },
  {
    id: "book_then_cancel_existing",
    utterance:
      "I need to move my appointment — wait, actually cancel my Thursday one first, then find me something next week.",
    notes: "Reorder goals when caller revises mid-turn.",
  },
  {
    id: "intake_burst",
    utterance: "I'm Anthony, email anthony@example.com, and I need a cleaning sometime next Tuesday morning.",
    notes: "Multiple intake fields + scheduling in one breath.",
  },
  {
    id: "correction",
    utterance: "Sorry not Tuesday — Wednesday morning works better.",
    notes: "Scheduling correction increments generation; stale FIND superseded.",
  },
  {
    id: "goal_change_inflight",
    utterance: "While you're checking that… actually just cancel my appointment.",
    notes: "Active operation + goal switch; registry + replan.",
  },
  {
    id: "ambiguous_appointment",
    utterance: "Cancel my appointment next week.",
    notes: "Multiple candidates → recovery, no mutating op until resolved.",
  },
];

function main() {
  if (!ENABLED) {
    console.log("SKIP voice-v3-live-astra-multi-goal-cert (set VOICE_V3_LIVE_ASTRA_CERT=1 to run)");
    console.log(`Prepared ${LIVE_ASTRA_MESSY_CASES.length} cases for Live+Astra PSTN-adjacent cert.`);
    return;
  }
  assert.ok(BASE, "VOICE_V3_CERT_BASE_URL or UI_AGENT_BASE_URL required");
  console.log(
    "Live+Astra cert must be executed on staging with real audio/session tooling.",
    "Case catalog:",
    LIVE_ASTRA_MESSY_CASES.map((c) => c.id).join(", "),
  );
  console.log("VOICE_V3_LIVE_ASTRA_MULTI_GOAL_CERT_SKIPPED_IMPLEMENTATION");
}

main();
