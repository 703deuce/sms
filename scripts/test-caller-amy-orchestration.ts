/**
 * Caller Amy orchestration + call identity regression tests.
 * Run: npx tsx scripts/test-caller-amy-orchestration.ts
 */
import {
  deriveNextAction,
  schedulingDoNotAdvanceHint,
  stateAwareToolQualifier,
} from "../src/lib/voice/workflow-engine/next-action";
import { requirementsToToolResponse } from "../src/lib/voice/field-runtime/requirements";
import {
  isUnknownCallerId,
  normalizeCallerAni,
} from "../src/lib/voice/call-identity";
import { compileCallerToolPlaybookForPrompt } from "../src/lib/agents/appointment-booking/intelligence/caller-tool-playbook";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

check(
  "playbook does not inject BOOKING_TOOL_CHAIN step 2 calendar",
  !compileCallerToolPlaybookForPrompt(["calendar_availability"]).includes(
    "2. calendar_availability",
  ),
);
check(
  "playbook injects runtime authority",
  compileCallerToolPlaybookForPrompt(["record_current_field"]).includes(
    "runtime is authoritative",
  ),
);
check(
  "calendar qualifier mentions CHECKING_AVAILABILITY",
  stateAwareToolQualifier("calendar_availability").includes("CHECKING_AVAILABILITY"),
);
check(
  "book qualifier mentions READY_TO_BOOK",
  stateAwareToolQualifier("book_appointment").includes("READY_TO_BOOK"),
);
check(
  "COLLECTING_FIELDS next_action is collect",
  deriveNextAction({
    state: "COLLECTING_FIELDS",
    complete: false,
    currentField: {
      field_id: "fld_test",
      label: "Problem description",
      type: "text",
      required: true,
      collection_instruction: "Describe the problem",
    },
  })?.includes("COLLECT_CURRENT_FIELD") === true,
);
check(
  "scheduling hint during collection",
  schedulingDoNotAdvanceHint("COLLECTING_FIELDS")?.includes("DO NOT ADVANCE") === true,
);

const partial = requirementsToToolResponse(
  {
    workflow: "book_appointment",
    session_id: "call_1",
    complete: false,
    missing_fields: [
      {
        field_id: "fld_problem",
        label: "Problem",
        type: "text",
        required: true,
        collection_instruction: "Describe problem",
      },
    ],
    collected_field_ids: ["sys_name"],
    active_field: "fld_problem",
    fields_to_collect: [],
    speak: "Describe the problem",
  },
  { operationSucceeded: true, workflowState: "COLLECTING_FIELDS" },
);
check("partial save returns ok:true", partial.ok === true);
check("partial save workflow_complete:false", partial.workflow_complete === false);
check("requirements read returns ok:true when incomplete", partial.success === true);

const complete = requirementsToToolResponse(
  {
    workflow: "book_appointment",
    session_id: "call_1",
    complete: true,
    missing_fields: [],
    collected_field_ids: ["sys_name"],
    active_field: null,
    fields_to_collect: [],
    speak: null,
  },
  { operationSucceeded: true, workflowState: "CHECKING_AVAILABILITY" },
);
check("complete requirements ok:true", complete.ok === true);
check("complete workflow_complete:true", complete.workflow_complete === true);

check("normalizeCallerAni E.164", normalizeCallerAni("+15714776175") === "+15714776175");
check("unknown ANI rejected", normalizeCallerAni("unknown") === null);
check("isUnknownCallerId", isUnknownCallerId("unknown") && !isUnknownCallerId("+15551234567"));

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`, failures);
  process.exit(1);
}
console.log("\nCaller Amy orchestration checks passed.");
