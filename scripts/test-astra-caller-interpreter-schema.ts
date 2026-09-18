import {
  parseCallerMeaningFromModelJson,
} from "../src/lib/voice-receptionist-wizard/astra-caller-interpreter";
import { callerMeaningToIntentInterpretation } from "../src/lib/voice-receptionist-wizard/caller-meaning-apply";
import {
  detectInterpreterWorkflowAuthorityViolation,
} from "../src/lib/voice-receptionist-wizard/caller-interpreter-schema";

function main() {
  const violation = detectInterpreterWorkflowAuthorityViolation({
    active_goal: "BOOK_APPOINTMENT",
    stage: "FIND_AVAILABILITY",
    required_action: "voice_v2_find_availability",
  });
  if (!violation || !violation.forbiddenKeys.includes("stage")) {
    console.error("FAIL violation detection");
    process.exit(1);
  }

  const parsed = parseCallerMeaningFromModelJson(
    {
      active_goal: "BOOK_APPOINTMENT",
      facts: { requested_date: "2026-09-25", requested_daypart: "morning" },
      corrections: [],
      explicit_action_requests: [],
      ambiguities: [],
      confidence: 0.98,
      stage: "FIND_AVAILABILITY",
      required_action: "FIND",
    },
    "book Friday morning",
  );
  if (parsed !== null) {
    console.error("FAIL forbidden keys should reject interpretation");
    process.exit(1);
  }

  const good = parseCallerMeaningFromModelJson(
    {
      active_goal: "BOOK_APPOINTMENT",
      facts: { requested_date: "2026-09-25", requested_daypart: "morning" },
      corrections: [],
      explicit_action_requests: [],
      ambiguities: [],
      confidence: 0.98,
      digression: false,
    },
    "book Friday morning",
  );
  if (!good) {
    console.error("FAIL valid parse");
    process.exit(1);
  }
  const intent = callerMeaningToIntentInterpretation(good);
  if (intent.intent !== "BOOK_APPOINTMENT" || intent.entities.requested_day !== "2026-09-25") {
    console.error("FAIL intent mapping", intent);
    process.exit(1);
  }
  console.log("PASS test-astra-caller-interpreter-schema");
}

main();
