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

check("COLLECTING blocks runtime_turn", !isToolAllowedForState("COLLECTING_FIELDS", "runtime_turn"));
check("COLLECTING allows record_current_field", isToolAllowedForState("COLLECTING_FIELDS", "record_current_field"));
check("COLLECTING allows continue_workflow", isToolAllowedForState("COLLECTING_FIELDS", "continue_workflow"));
check("COLLECTING blocks direct book", !isToolAllowedForState("COLLECTING_FIELDS", "book_appointment"));
check("READY allows continue_workflow", isToolAllowedForState("READY_TO_BOOK", "continue_workflow"));
check("READY blocks direct book", !isToolAllowedForState("READY_TO_BOOK", "book_appointment"));
check(
  "READY blocks direct calendar_availability",
  !isToolAllowedForState("READY_TO_BOOK", "calendar_availability"),
);
check("BOOKING blocks direct transfer", !isToolAllowedForState("BOOKING_IN_PROGRESS", "transfer"));
check("SELECTING allows continue_workflow", isToolAllowedForState("SELECTING_SLOT", "continue_workflow"));
check(
  "SELECTING blocks direct hold",
  !isToolAllowedForState("SELECTING_SLOT", "hold_appointment_slot"),
);
check("INTENT allows lookup_customer", isToolAllowedForState("INTENT_DISCOVERY", "lookup_customer"));
check("INTENT blocks runtime_turn", !isToolAllowedForState("INTENT_DISCOVERY", "runtime_turn"));
check("COMPLETE allows get_runtime_context", isToolAllowedForState("COMPLETE", "get_runtime_context"));
check(
  "COMPLETE blocks direct cancel",
  !isToolAllowedForState("COMPLETE", "cancel_appointment"),
);

const prevPreprod = process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS;
process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS = "1";
check(
  "preprod allows calendar_availability in READY",
  isToolAllowedForState("READY_TO_BOOK", "calendar_availability"),
);
check(
  "preprod allows book in READY",
  isToolAllowedForState("READY_TO_BOOK", "book_appointment"),
);
process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS = prevPreprod;

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`, failures);
  process.exit(1);
}
console.log("\nAgent decision scenario checks passed.");
