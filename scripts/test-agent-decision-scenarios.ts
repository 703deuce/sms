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

check("COLLECTING blocks book", !isToolAllowedForState("COLLECTING_FIELDS", "book_appointment"));
check("COLLECTING allows record_current_field", isToolAllowedForState("COLLECTING_FIELDS", "record_current_field"));
check("READY allows book", isToolAllowedForState("READY_TO_BOOK", "book_appointment"));
check("READY blocks calendar during confirm", !isToolAllowedForState("READY_TO_BOOK", "calendar_availability"));
check("BOOKING blocks transfer", !isToolAllowedForState("BOOKING_IN_PROGRESS", "transfer"));
check("SELECTING allows hold", isToolAllowedForState("SELECTING_SLOT", "hold_appointment_slot"));
check("INTENT allows lookup", isToolAllowedForState("INTENT_DISCOVERY", "lookup_customer"));
check("COMPLETE allows cancel", isToolAllowedForState("COMPLETE", "cancel_appointment"));

if (failures.length) {
  console.error(failures);
  process.exit(1);
}
console.log("\nAgent decision scenario checks passed.");
