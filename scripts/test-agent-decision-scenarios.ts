/**
 * Agent decision tests — deterministic workflow guards without LLM.
 * Run: npx tsx scripts/test-agent-decision-scenarios.ts
 */
import { isToolAllowedForState } from "../src/lib/voice/workflow-engine/states";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

// Production surface — model only calls runtime_turn; scheduling is internal.
check("COLLECTING allows runtime_turn", isToolAllowedForState("COLLECTING_FIELDS", "runtime_turn"));
check("COLLECTING blocks direct book", !isToolAllowedForState("COLLECTING_FIELDS", "book_appointment"));
check(
  "COLLECTING blocks direct record_current_field",
  !isToolAllowedForState("COLLECTING_FIELDS", "record_current_field"),
);
check("READY allows runtime_turn", isToolAllowedForState("READY_TO_BOOK", "runtime_turn"));
check("READY blocks direct book", !isToolAllowedForState("READY_TO_BOOK", "book_appointment"));
check(
  "READY blocks direct calendar_availability",
  !isToolAllowedForState("READY_TO_BOOK", "calendar_availability"),
);
check("BOOKING blocks direct transfer", !isToolAllowedForState("BOOKING_IN_PROGRESS", "transfer"));
check("SELECTING allows runtime_turn", isToolAllowedForState("SELECTING_SLOT", "runtime_turn"));
check(
  "SELECTING blocks direct hold",
  !isToolAllowedForState("SELECTING_SLOT", "hold_appointment_slot"),
);
check("INTENT allows runtime_turn", isToolAllowedForState("INTENT_DISCOVERY", "runtime_turn"));
check(
  "INTENT blocks direct lookup",
  !isToolAllowedForState("INTENT_DISCOVERY", "lookup_customer"),
);
check("COMPLETE allows runtime_turn", isToolAllowedForState("COMPLETE", "runtime_turn"));
check(
  "COMPLETE blocks direct cancel",
  !isToolAllowedForState("COMPLETE", "cancel_appointment"),
);

const prevPreprod = process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS;
process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS = "1";
check(
  "preprod allows record_current_field in COLLECTING",
  isToolAllowedForState("COLLECTING_FIELDS", "record_current_field"),
);
check(
  "preprod allows book in READY",
  isToolAllowedForState("READY_TO_BOOK", "book_appointment"),
);
if (prevPreprod == null) delete process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS;
else process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS = prevPreprod;

if (failures.length) {
  console.error(failures);
  process.exit(1);
}
console.log("\nAgent decision scenario checks passed.");
