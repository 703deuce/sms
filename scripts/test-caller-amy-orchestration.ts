/**
 * Caller Amy orchestration + publish surface regression tests.
 * Run: npx tsx scripts/test-caller-amy-orchestration.ts
 */
import { buildAssistantTools } from "../src/lib/voice/telnyx/assistant-tools";
import { resolveEnabledBuiltinTools } from "../src/lib/voice/tools/catalog";
import {
  CALLER_AMY_INTERNAL_ONLY_TOOLS,
  CALLER_AMY_MODEL_TOOLS,
  filterToolsForCallerAmyPublish,
} from "../src/lib/voice/workflow-engine/tool-publish";
import {
  deriveNextAction,
  schedulingDoNotAdvanceHint,
} from "../src/lib/voice/workflow-engine/next-action";
import { requirementsToToolResponse, resolveActiveField } from "../src/lib/voice/field-runtime/requirements";
import { isStubInboundContactName } from "../src/lib/voice/field-runtime/session";
import {
  isUnknownCallerId,
  normalizeCallerAni,
} from "../src/lib/voice/call-identity";
import { compileCallerToolPlaybookForPrompt } from "../src/lib/agents/appointment-booking/intelligence/caller-tool-playbook";
import { assertToolAllowed } from "../src/lib/voice/workflow-engine/guard";
import { isToolAllowedForState } from "../src/lib/voice/workflow-engine/states";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

const enabled = resolveEnabledBuiltinTools({ agentType: "appointment_booking" });
const published = filterToolsForCallerAmyPublish(enabled);
const telnyxTools = buildAssistantTools({
  workspaceId: "ws_test",
  agentId: "agent_test",
  bucketIds: [],
  tools: [],
  enabledBuiltinTools: enabled,
  agentType: "appointment_booking",
});

const telnyxNames = telnyxTools
  .map((t) => {
    const w = (t as { webhook?: { name?: string } }).webhook;
    const h = (t as { hangup?: unknown }).hangup;
    if (w) return w.name;
    if (h) return "hangup";
    return null;
  })
  .filter(Boolean) as string[];

check(
  "publish filter excludes calendar_availability",
  !published.includes("calendar_availability"),
);
check("publish filter excludes book_appointment", !published.includes("book_appointment"));
check("publish filter excludes resolve_datetime", !published.includes("resolve_datetime"));
check("publish filter includes continue_workflow", published.includes("continue_workflow"));
check("publish filter includes record_current_field", published.includes("record_current_field"));
check(
  "Telnyx build excludes calendar_availability",
  !telnyxNames.includes("calendar_availability"),
);
check("Telnyx build excludes book_appointment", !telnyxNames.includes("book_appointment"));
check("Telnyx build includes continue_workflow", telnyxNames.includes("continue_workflow"));

const EXPECTED_EXACT = [
  "lookup_customer",
  "take_structured_message",
  "record_current_field",
  "continue_workflow",
  "get_runtime_context",
  "escalate_human",
  "hangup",
];
for (const name of EXPECTED_EXACT) {
  check(`exact catalog includes ${name}`, telnyxNames.includes(name));
}
for (const forbidden of [
  "calendar_availability",
  "book_appointment",
  "resolve_datetime",
  "hold_appointment_slot",
  "save_collected_fields",
  "get_workflow_requirements",
]) {
  check(`exact catalog excludes ${forbidden}`, !telnyxNames.includes(forbidden));
}

check(
  "Telnyx tool count is small (<=10)",
  telnyxNames.length <= 10,
  `got ${telnyxNames.length}: ${telnyxNames.join(", ")}`,
);

for (const internal of [
  "calendar_availability",
  "book_appointment",
  "hold_appointment_slot",
]) {
  check(`internal only: ${internal}`, CALLER_AMY_INTERNAL_ONLY_TOOLS.has(internal));
}

for (const model of CALLER_AMY_MODEL_TOOLS) {
  check(`model surface includes ${model}`, published.includes(model));
}

check(
  "playbook does not inject BOOKING_TOOL_CHAIN step 2 calendar",
  !compileCallerToolPlaybookForPrompt(["continue_workflow"]).includes(
    "2. calendar_availability",
  ),
);
check(
  "playbook injects runtime authority",
  compileCallerToolPlaybookForPrompt(["continue_workflow"]).includes(
    "runtime is authoritative",
  ),
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
  "CHECKING_AVAILABILITY next_action uses continue_workflow",
  deriveNextAction({
    state: "CHECKING_AVAILABILITY",
    complete: true,
    currentField: null,
  })?.includes("continue_workflow") === true,
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

check("normalizeCallerAni E.164", normalizeCallerAni("+15714776175") === "+15714776175");
check("unknown ANI rejected", normalizeCallerAni("unknown") === null);
check("isUnknownCallerId", isUnknownCallerId("unknown") && !isUnknownCallerId("+15551234567"));

check("stub inbound contact name detected", isStubInboundContactName("Caller", "9555"));
check("real contact name not stub", !isStubInboundContactName("Anthony", "Johnson"));
check(
  "active_field advances when stale",
  resolveActiveField(
    { session_id: "s", fields: {}, derived: {}, active_field: "sys_name", workflow: "book_appointment", updated_at: "" },
    [{ field_id: "sys_email", label: "Email", type: "email", required: true, collection_instruction: "" }],
  ) === "sys_email",
);

check(
  "COLLECTING allows continue_workflow",
  isToolAllowedForState("COLLECTING_FIELDS", "continue_workflow"),
);
check(
  "COLLECTING allows record_current_field",
  isToolAllowedForState("COLLECTING_FIELDS", "record_current_field"),
);

async function guardChecks() {
  const blocked = await assertToolAllowed({
    workspaceId: "ws_test",
    callId: "call_test",
    toolType: "calendar_availability",
  });
  check(
    "calendar_availability blocked as internal-only",
    !blocked.allowed && blocked.error_code === "TOOL_INTERNAL_ONLY",
  );
}

async function main() {
  await guardChecks();

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`, failures);
    process.exit(1);
  }
  console.log("\nCaller Amy orchestration checks passed.");
  console.log("Telnyx-visible tools:", telnyxNames.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
