import {
  parseAstraCallerInterpretation,
  astraToVoiceCallerIntent,
} from "../src/lib/voice-v2/astra-caller-interpreter";

function main() {
  const raw = {
    active_goal: "BOOK_APPOINTMENT",
    facts: { requested_date: "2026-09-25", requested_daypart: "morning" },
    corrections: [],
    explicit_action_requests: [],
    ambiguities: [],
    confidence: 0.98,
    stage: "FIND_AVAILABILITY",
    required_action: "FIND_AVAILABILITY",
  };
  const parsed = parseAstraCallerInterpretation(raw);
  if (!parsed) {
    console.error("FAIL parse");
    process.exit(1);
  }
  if ("stage" in (raw as object) && "required_action" in (raw as object)) {
    // Input had forbidden keys; parser must not expose them on result.
    const leaked = Object.keys(parsed).some((k) =>
      ["stage", "required_action", "offer_set_id"].includes(k),
    );
    if (leaked) {
      console.error("FAIL forbidden workflow keys on parsed object");
      process.exit(1);
    }
  }
  const intent = astraToVoiceCallerIntent(parsed, "book Friday morning");
  if (intent.intent !== "BOOK_APPOINTMENT") {
    console.error("FAIL intent", intent);
    process.exit(1);
  }
  if (intent.entities.requested_day !== "2026-09-25") {
    console.error("FAIL date entity", intent.entities);
    process.exit(1);
  }
  console.log("PASS test-astra-caller-interpreter-schema");
}

main();
