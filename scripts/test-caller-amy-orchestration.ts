/**
 * Caller Amy orchestration + publish surface regression tests.
 * Run: npx tsx scripts/test-caller-amy-orchestration.ts
 */
import { buildAssistantTools } from "../src/lib/voice/telnyx/assistant-tools";
import { resolveEnabledBuiltinTools } from "../src/lib/voice/tools/catalog";
import {
  CALLER_AMY_INTERNAL_ONLY_TOOLS,
  CALLER_AMY_PUBLISHED_WEBHOOK_TOOLS,
  CALLER_AMY_WORKFLOW_WEBHOOK_TOOLS,
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
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

function telnyxToolNames(
  input: Parameters<typeof buildAssistantTools>[0],
): string[] {
  return buildAssistantTools(input)
    .map((t) => {
      const w = (t as { webhook?: { name?: string } }).webhook;
      const h = (t as { hangup?: unknown }).hangup;
      if (w) return w.name;
      if (h) return "hangup";
      return null;
    })
    .filter(Boolean) as string[];
}

const legacyConfig: VoiceAgentConfig = {
  advanced: { minimumSideEffectMode: false },
} as VoiceAgentConfig;

const minimumConfig = applyAmyMinimumSideEffectConfig({
  enabledBuiltinTools: [],
} as VoiceAgentConfig);

const legacyEnabled = resolveEnabledBuiltinTools({ agentType: "appointment_booking" });
const legacyPublished = filterToolsForCallerAmyPublish(legacyEnabled, legacyConfig);
const legacyTelnyxNames = telnyxToolNames({
  workspaceId: "ws_test",
  agentId: "agent_test",
  bucketIds: [],
  tools: [],
  enabledBuiltinTools: legacyEnabled,
  agentType: "appointment_booking",
  voiceConfig: legacyConfig,
});

const minimumEnabled = minimumConfig.enabledBuiltinTools || [];
const minimumPublished = filterToolsForCallerAmyPublish(minimumEnabled, minimumConfig);
const minimumTelnyxNames = telnyxToolNames({
  workspaceId: "ws_test",
  agentId: "agent_test",
  bucketIds: [],
  tools: [],
  enabledBuiltinTools: minimumEnabled,
  agentType: "appointment_booking",
  voiceConfig: minimumConfig,
});

check(
  "legacy publish excludes calendar_availability",
  !legacyPublished.includes("calendar_availability"),
);
check("legacy publish excludes book_appointment", !legacyPublished.includes("book_appointment"));
check("legacy publish includes continue_workflow", legacyPublished.includes("continue_workflow"));
check(
  "legacy publish includes record_current_field",
  legacyPublished.includes("record_current_field"),
);
check(
  "legacy Telnyx build includes continue_workflow",
  legacyTelnyxNames.includes("continue_workflow"),
);

for (const name of [...CALLER_AMY_WORKFLOW_WEBHOOK_TOOLS, "hangup"] as const) {
  check(`legacy catalog includes ${name}`, legacyTelnyxNames.includes(name));
}
for (const forbidden of [
  "calendar_availability",
  "book_appointment",
  "send_sms",
  "record_call_fact",
]) {
  check(`legacy catalog excludes ${forbidden}`, !legacyTelnyxNames.includes(forbidden));
}

check(
  "minimum publish includes send_sms",
  minimumPublished.includes("send_sms"),
);
check(
  "minimum publish includes record_call_fact",
  minimumPublished.includes("record_call_fact"),
);
check(
  "minimum publish excludes continue_workflow",
  !minimumPublished.includes("continue_workflow"),
);
check(
  "minimum publish excludes record_current_field",
  !minimumPublished.includes("record_current_field"),
);
check(
  "minimum Telnyx build includes send_sms",
  minimumTelnyxNames.includes("send_sms"),
);
check(
  "minimum Telnyx build includes record_call_fact",
  minimumTelnyxNames.includes("record_call_fact"),
);

for (const name of [...CALLER_AMY_PUBLISHED_WEBHOOK_TOOLS, "hangup"] as const) {
  check(`minimum catalog includes ${name}`, minimumTelnyxNames.includes(name));
}
for (const forbidden of [
  "calendar_availability",
  "book_appointment",
  "continue_workflow",
  "get_runtime_context",
  "record_current_field",
]) {
  check(`minimum catalog excludes ${forbidden}`, !minimumTelnyxNames.includes(forbidden));
}

check(
  "minimum Telnyx tool count is small (<=8)",
  minimumTelnyxNames.length <= 8,
  `got ${minimumTelnyxNames.length}: ${minimumTelnyxNames.join(", ")}`,
);

for (const internal of [
  "calendar_availability",
  "book_appointment",
  "hold_appointment_slot",
  "continue_workflow",
]) {
  check(`internal only: ${internal}`, CALLER_AMY_INTERNAL_ONLY_TOOLS.has(internal));
}

check(
  "legacy playbook injects runtime authority",
  compileCallerToolPlaybookForPrompt(["continue_workflow"]).includes(
    "runtime is authoritative",
  ),
);
check(
  "minimum playbook injects text-first authority",
  compileCallerToolPlaybookForPrompt(["send_sms", "record_call_fact"], {
    minimumSideEffect: true,
  }).includes("MINIMUM-SIDE-EFFECT"),
);
check(
  "minimum playbook does not inject runtime authority",
  !compileCallerToolPlaybookForPrompt(["send_sms"], { minimumSideEffect: true }).includes(
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

check("normalizeCallerAni E.164", normalizeCallerAni("[REDACTED]") === "[REDACTED]");
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
  console.log("Legacy Telnyx tools:", legacyTelnyxNames.join(", "));
  console.log("Minimum Telnyx tools:", minimumTelnyxNames.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
