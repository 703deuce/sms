/**
 * Telnyx Conversation Workflow architecture regression tests.
 * Run: npx tsx scripts/test-conversation-workflow.ts
 */
import {
  buildAmyConversationWorkflow,
  workflowNodeExpectedTools,
  WORKFLOW_NODE_IDS,
} from "../src/lib/voice/telnyx/conversation-workflow";
import {
  WORKFLOW_PUBLISHED_WEBHOOK_TOOLS,
  CANONICAL_AI_BOOKING_PUBLISHED_TOOL_KEYS,
  WORKFLOW_RETIRED_FLAT_TOOLS,
  filterToolsForCallerAmyPublish,
  isConversationWorkflowMode,
} from "../src/lib/voice/workflow-engine/tool-publish";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import { workflowToolResponse } from "../src/lib/voice/tools/workflow-tool-contract";
import type { VoiceAgentConfig } from "../src/lib/voice/types";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

const config = applyAmyMinimumSideEffectConfig({ enabledBuiltinTools: [] } as VoiceAgentConfig);
check("Amy config enables conversation workflow", isConversationWorkflowMode(config));

const published = filterToolsForCallerAmyPublish(config.enabledBuiltinTools || [], config);
for (const tool of WORKFLOW_PUBLISHED_WEBHOOK_TOOLS) {
  check(`published includes ${tool}`, published.includes(tool));
}
for (const retired of WORKFLOW_RETIRED_FLAT_TOOLS) {
  check(`published excludes retired ${retired}`, !published.includes(retired));
}

const toolIds = {
  sendResource: "st_send",
  searchDetails: "st_search",
  hangup: "st_hangup",
  transfer: "st_transfer",
};
const graph = buildAmyConversationWorkflow(toolIds, config);
const nodes = graph.nodes as Array<{ id: string; shared_tool_ids?: string[]; tools_mode?: string }>;
const edges = graph.edges as Array<{ condition?: { type?: string } }>;

check("workflow starts at GENERAL", graph.start_node_id === WORKFLOW_NODE_IDS.GENERAL);
check("workflow has 6 nodes", nodes.length === 6);

const canonicalConfig = {
  ...config,
  enabledBuiltinTools: [
    ...(config.enabledBuiltinTools || []),
    ...CANONICAL_AI_BOOKING_PUBLISHED_TOOL_KEYS,
  ],
  advanced: { ...(config.advanced || {}), voiceCanonicalAiBooking: true },
} as VoiceAgentConfig;
const canonicalPublished = filterToolsForCallerAmyPublish(
  canonicalConfig.enabledBuiltinTools || [],
  canonicalConfig,
);
for (const tool of CANONICAL_AI_BOOKING_PUBLISHED_TOOL_KEYS) {
  check(`canonical publish includes ${tool}`, canonicalPublished.includes(tool));
}
const canonicalGraph = buildAmyConversationWorkflow(
  { ...toolIds, voiceAiBooking: "st_booking" },
  canonicalConfig,
);
const canonicalNodes = canonicalGraph.nodes as Array<{ id: string }>;
check(
  "canonical workflow has Live Booking node",
  canonicalNodes.some((n) => n.id === WORKFLOW_NODE_IDS.LIVE_BOOKING),
);
check(
  "GENERAL uses tools_mode replace with zero tools",
  nodes.find((n) => n.id === WORKFLOW_NODE_IDS.GENERAL)?.tools_mode === "replace" &&
    (nodes.find((n) => n.id === WORKFLOW_NODE_IDS.GENERAL)?.shared_tool_ids?.length || 0) === 0,
);
check(
  "ACTION scopes send_resource only",
  workflowNodeExpectedTools(WORKFLOW_NODE_IDS.ACTION, toolIds).join() === "send_resource",
);
check(
  "DETAILED_LOOKUP scopes search_business_details",
  workflowNodeExpectedTools(WORKFLOW_NODE_IDS.DETAILED_LOOKUP, toolIds).includes(
    "search_business_details",
  ),
);
check(
  "HUMAN scopes transfer",
  workflowNodeExpectedTools(WORKFLOW_NODE_IDS.HUMAN, toolIds).includes("transfer"),
);
check(
  "CLOSING scopes hangup",
  workflowNodeExpectedTools(WORKFLOW_NODE_IDS.CLOSING, toolIds).includes("hangup"),
);

const expressionEdges = edges.filter((e) => e.condition?.type === "expression");
check("workflow has deterministic expression edges", expressionEdges.length >= 2);

const afterHoursWizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
const ahConfig = applyAmyMinimumSideEffectConfig({
  enabledBuiltinTools: [],
  advanced: { appointmentReceptionistWizard: afterHoursWizard },
} as VoiceAgentConfig);
const ahGraph = buildAmyConversationWorkflow(toolIds, ahConfig);
const ahGeneral = (ahGraph.nodes as Array<{ id: string; instructions?: string }>).find(
  (n) => n.id === WORKFLOW_NODE_IDS.GENERAL,
);
check(
  "after-hours GENERAL includes booking-link intake",
  Boolean(ahGeneral?.instructions?.includes("Do not call send_resource until")),
);
const ahEdges = ahGraph.edges as Array<{ id?: string; condition?: { type?: string; prompt?: string } }>;
const ahActionEdge = ahEdges.find((e) => e.id === "e_general_action");
check(
  "after-hours ACTION edge requires SMS consent",
  Boolean(ahActionEdge?.condition?.prompt?.includes("agreed to receive a text")),
);
check(
  "after-hours has consent_required return to GENERAL",
  ahEdges.some((e) => e.id === "e_action_general_consent"),
);

const contract = workflowToolResponse({
  status: "success",
  result: "booking_link_sent",
  speak: "Done.",
  dynamicVariables: { resource_send_status: "success", resource_send_type: "booking" },
});
check("tool contract ok on success", contract.ok === true);
check(
  "tool contract exposes dynamic variables",
  contract.dynamic_variables?.resource_send_status === "success",
);
const already = workflowToolResponse({
  status: "already_completed",
  result: "booking_link_already_sent",
});
check("already_completed is ok for speak path", already.ok === true);

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`, failures);
  process.exit(1);
}
console.log("\nConversation workflow checks passed.");
