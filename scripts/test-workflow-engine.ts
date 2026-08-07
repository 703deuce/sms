/**
 * Workflow engine unit tests.
 * Run: npx tsx scripts/test-workflow-engine.ts
 */
import {
  canonicalToolType,
  isToolAllowedForState,
  toolsForState,
  STATE_ALLOWED_TOOLS,
} from "../src/lib/voice/workflow-engine/states";
import { emptyAgentRuntime, appendFieldReceipt, transitionState } from "../src/lib/voice/workflow-engine/runtime-state";

const failures: string[] = [];

function check(name: string, cond: boolean, detail?: string) {
  if (!cond) {
    failures.push(detail ? `${name}: ${detail}` : name);
    console.error("✗", name, detail || "");
  } else {
    console.log("✓", name);
  }
}

check("canonical aliases", canonicalToolType("check_availability") === "calendar_availability");
check("canonical save shim", canonicalToolType("save_caller_info") === "save_collected_fields");

check(
  "COLLECTING allows record_current_field",
  isToolAllowedForState("COLLECTING_FIELDS", "record_current_field"),
);
check(
  "READY_TO_BOOK allows book_appointment",
  isToolAllowedForState("READY_TO_BOOK", "book_appointment"),
);
check(
  "COLLECTING blocks book_appointment",
  !isToolAllowedForState("COLLECTING_FIELDS", "book_appointment"),
);
check(
  "BOOKING_IN_PROGRESS blocks transfer",
  !isToolAllowedForState("BOOKING_IN_PROGRESS", "transfer"),
);
check(
  "BOOKING_IN_PROGRESS allows book_appointment",
  isToolAllowedForState("BOOKING_IN_PROGRESS", "book_appointment"),
);

check(
  "escape hatches in COLLECTING",
  toolsForState("COLLECTING_FIELDS").includes("transfer"),
);
check(
  "get_runtime_context in all booking states",
  (["COLLECTING_FIELDS", "CHECKING_AVAILABILITY", "SELECTING_SLOT", "READY_TO_BOOK"] as const).every(
    (s) => STATE_ALLOWED_TOOLS[s].includes("get_runtime_context"),
  ),
);

const runtime = emptyAgentRuntime({ workflowId: "book_appointment" });
check("initial state", runtime.state === "INTENT_DISCOVERY");
const transitioned = transitionState(runtime, "COLLECTING_FIELDS", "intent_set");
check("transition updates state", transitioned.state === "COLLECTING_FIELDS");
check("transition history", transitioned.state_history.length === 2);

const withReceipt = appendFieldReceipt(transitioned, "fld_test", "hello");
check("field receipt", withReceipt.field_receipts.some((r) => r.field_id === "fld_test"));

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`);
  process.exit(1);
}
console.log("\nWorkflow engine unit checks passed.");
