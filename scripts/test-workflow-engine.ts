/**
 * Workflow engine unit tests.
 * Run: npx tsx scripts/test-workflow-engine.ts
 */
import {
  canonicalToolType,
  isToolAllowedForState,
} from "../src/lib/voice/workflow-engine/states";
import { emptyAgentRuntime, appendFieldReceipt, transitionState } from "../src/lib/voice/workflow-engine/runtime-state";
import { assertToolAllowed } from "../src/lib/voice/workflow-engine/guard";

const failures: string[] = [];

function withPreprodLegacyTools<T>(run: () => T): T {
  const previous = process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS;
  process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS = "1";
  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS;
    } else {
      process.env.VOICE_PREPROD_ALLOW_INTERNAL_TOOLS = previous;
    }
  }
}

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
  withPreprodLegacyTools(() => isToolAllowedForState("COLLECTING_FIELDS", "record_current_field")),
);
check(
  "READY_TO_BOOK allows continue_workflow",
  withPreprodLegacyTools(() => isToolAllowedForState("READY_TO_BOOK", "continue_workflow")),
);
check(
  "COLLECTING blocks book_appointment",
  !isToolAllowedForState("COLLECTING_FIELDS", "book_appointment"),
);
check(
  "COLLECTING blocks calendar_availability",
  !isToolAllowedForState("COLLECTING_FIELDS", "calendar_availability"),
);
check(
  "CHECKING_AVAILABILITY allows continue_workflow",
  withPreprodLegacyTools(() => isToolAllowedForState("CHECKING_AVAILABILITY", "continue_workflow")),
);
check(
  "INTENT_DISCOVERY blocks calendar_availability",
  !isToolAllowedForState("INTENT_DISCOVERY", "calendar_availability"),
);
check(
  "BOOKING_IN_PROGRESS blocks transfer",
  !isToolAllowedForState("BOOKING_IN_PROGRESS", "transfer"),
);
check(
  "BOOKING_IN_PROGRESS allows continue_workflow",
  withPreprodLegacyTools(() => isToolAllowedForState("BOOKING_IN_PROGRESS", "continue_workflow")),
);
check(
  "escape hatches in COLLECTING",
  withPreprodLegacyTools(() => isToolAllowedForState("COLLECTING_FIELDS", "escalate_human")),
);
check(
  "get_runtime_context in all booking states",
  withPreprodLegacyTools(() =>
    (["COLLECTING_FIELDS", "CHECKING_AVAILABILITY", "SELECTING_SLOT", "READY_TO_BOOK"] as const).every(
      (s) => isToolAllowedForState(s, "get_runtime_context"),
    ),
  ),
);

const runtime = emptyAgentRuntime({ workflowId: "book_appointment" });
check("initial state", runtime.state === "INTENT_DISCOVERY");
const transitioned = transitionState(runtime, "COLLECTING_FIELDS", "intent_set");
check("transition updates state", transitioned.state === "COLLECTING_FIELDS");
check("transition history", transitioned.state_history.length === 2);

const withReceipt = appendFieldReceipt(transitioned, "fld_test", "hello");
check("field receipt", withReceipt.field_receipts.some((r) => r.field_id === "fld_test"));

async function runAsyncChecks() {
  const blockedNoCall = await assertToolAllowed({
    workspaceId: "ws_test",
    toolType: "calendar_availability",
  });
  check(
    "calendar blocked without call context",
    blockedNoCall.allowed === false &&
      (blockedNoCall.error_code === "TOOL_INTERNAL_ONLY" ||
        blockedNoCall.error_code === "TOOL_NOT_ALLOWED_FOR_STATE"),
  );
}

runAsyncChecks()
  .then(() => {
    if (failures.length) {
      console.error(`\n${failures.length} failure(s)`);
      process.exit(1);
    }
    console.log("\nWorkflow engine unit checks passed.");
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
