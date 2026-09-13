/**
 * Telnyx Conversation Workflow graph for Amy receptionist (capability scopes).
 */

import type { VoiceAgentConfig } from "@/lib/voice/types";
import { isAfterHoursVoiceProfile } from "@/lib/voice/runtime/voice-profile";
import {
  expressionEdgeCondition,
  exprVarEqualsBool,
  exprVarEqualsString,
  llmEdgeCondition,
} from "./workflow-expression";

export const WORKFLOW_NODE_IDS = {
  GENERAL: "n_general",
  ACTION: "n_action",
  DETAILED_LOOKUP: "n_detailed_lookup",
  HUMAN: "n_human",
  RECOVERY: "n_recovery",
  CLOSING: "n_closing",
} as const;

export type WorkflowSharedToolIds = {
  sendResource?: string | null;
  searchDetails?: string | null;
  hangup?: string | null;
  transfer?: string | null;
  retrieval?: string | null;
};

const ACTION_INSTRUCTIONS = [
  "The caller wants a live action — usually a texted resource link.",
  "Use send_resource once with the resource_type that matches what they asked for (booking, quote, financing, directions, photo_upload).",
  "Do not claim the text was sent until send_resource returns success.",
  "If they change subject to a general question, stop trying to send a link.",
].join(" ");

const AFTER_HOURS_ACTION_INSTRUCTIONS = [
  "The caller agreed to receive a text message with a link.",
  "Call send_resource exactly once with resource_type booking (or quote/financing/directions as appropriate). Include verbal_sms_consent true when the caller said yes to texting.",
  "If send_resource says consent is required, return to normal conversation and ask for permission to text — do not repeat the same sentence.",
  "Confirm the text only after send_resource returns success, then continue the call if they have more questions.",
].join(" ");

const AFTER_HOURS_GENERAL_APPEND = [
  "For scheduling or booking: explain you can text a booking link (not live calendar booking on this call).",
  "Gather any minimum details the business needs, then ask: \"Is it okay if I send that by text? Message and data rates may apply.\"",
  "Do not call send_resource until they clearly say yes to texting.",
  "Do not say you are saving a request or that the team will follow up unless SMS is declined or send_resource failed.",
  "Never repeat the same opening line twice — always advance the conversation.",
].join(" ");

const DETAILED_LOOKUP_INSTRUCTIONS = [
  "The caller needs detailed or long-tail business/product information not covered in the base prompt.",
  "Use search_business_details with their question.",
  "Answer concisely in spoken language. Do not read URLs.",
].join(" ");

const HUMAN_INSTRUCTIONS = [
  "The caller wants a person. Use the Transfer tool to connect them.",
  "If transfer is unavailable, apologize and offer to take their information for a callback.",
  "Do not claim you connected them until transfer succeeds.",
].join(" ");

const RECOVERY_INSTRUCTIONS = [
  "A requested action could not be completed (link unavailable, SMS failed, or transfer unavailable).",
  "Apologize briefly. Use information already given in this call — do not re-ask for name, phone, address, or issue if the caller already provided them.",
  "Confirm you have their details and that the team will follow up; only ask for a missing field if truly unknown.",
  "Do not call tools unless the caller explicitly asks for a different action you can complete.",
].join(" ");

const CLOSING_INSTRUCTIONS = [
  "The caller is done. Thank them warmly and use hangup when the conversation is fully finished.",
].join(" ");

function wizardFromConfig(config?: VoiceAgentConfig | null) {
  const advanced = (config?.advanced || {}) as Record<string, unknown>;
  return advanced.appointmentReceptionistWizard as
    | import("@/lib/solutions/appointment-receptionist/types").AppointmentReceptionistWizardState
    | undefined;
}

export function buildAmyConversationWorkflow(
  toolIds: WorkflowSharedToolIds,
  config?: VoiceAgentConfig | null,
): Record<string, unknown> {
  const wizard = wizardFromConfig(config);
  const afterHours = wizard ? isAfterHoursVoiceProfile(wizard) : false;
  const generalInstructions = afterHours
    ? `Answer ordinary business questions from the base prompt. Do not call tools for hours, services, service area, or common FAQs. ${AFTER_HOURS_GENERAL_APPEND}`
    : "Answer ordinary business questions from the base prompt. Do not call tools for hours, services, service area, or common FAQs.";
  const actionInstructions = afterHours ? AFTER_HOURS_ACTION_INSTRUCTIONS : ACTION_INSTRUCTIONS;
  const actionEdgeLlm = afterHours
    ? "The caller clearly agreed to receive a text message with a booking, quote, financing, or directions link (yes to SMS)."
    : "The caller wants to schedule, book, get a quote, receive financing information, directions, or asks to be texted a link.";

  const nodes: Record<string, unknown>[] = [
    {
      id: WORKFLOW_NODE_IDS.GENERAL,
      name: "General",
      type: "prompt",
      instructions_mode: "append",
      instructions: generalInstructions,
      shared_tool_ids: [],
      tools_mode: "replace",
      position: { x: 80, y: 80 },
    },
    {
      id: WORKFLOW_NODE_IDS.ACTION,
      name: "Send Resource",
      type: "prompt",
      instructions_mode: "append",
      instructions: actionInstructions,
      shared_tool_ids: toolIds.sendResource ? [toolIds.sendResource] : [],
      tools_mode: "replace",
      position: { x: 360, y: 40 },
    },
    {
      id: WORKFLOW_NODE_IDS.DETAILED_LOOKUP,
      name: "Detailed Lookup",
      type: "prompt",
      instructions_mode: "append",
      instructions: DETAILED_LOOKUP_INSTRUCTIONS,
      shared_tool_ids: [
        ...(toolIds.searchDetails ? [toolIds.searchDetails] : []),
        ...(toolIds.retrieval ? [toolIds.retrieval] : []),
      ].filter(Boolean),
      tools_mode: "replace",
      position: { x: 360, y: 200 },
    },
    {
      id: WORKFLOW_NODE_IDS.HUMAN,
      name: "Human Transfer",
      type: "prompt",
      instructions_mode: "append",
      instructions: HUMAN_INSTRUCTIONS,
      shared_tool_ids: toolIds.transfer ? [toolIds.transfer] : [],
      tools_mode: "replace",
      position: { x: 360, y: 360 },
    },
    {
      id: WORKFLOW_NODE_IDS.RECOVERY,
      name: "Recovery",
      type: "prompt",
      instructions_mode: "append",
      instructions: RECOVERY_INSTRUCTIONS,
      shared_tool_ids: [],
      tools_mode: "replace",
      position: { x: 640, y: 200 },
    },
    {
      id: WORKFLOW_NODE_IDS.CLOSING,
      name: "Closing",
      type: "prompt",
      instructions_mode: "append",
      instructions: CLOSING_INSTRUCTIONS,
      shared_tool_ids: toolIds.hangup ? [toolIds.hangup] : [],
      tools_mode: "replace",
      position: { x: 640, y: 360 },
    },
  ];

  const edges: Record<string, unknown>[] = [
    {
      id: "e_general_action",
      start_node_id: WORKFLOW_NODE_IDS.GENERAL,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.ACTION },
      condition: llmEdgeCondition(actionEdgeLlm),
    },
    {
      id: "e_general_lookup",
      start_node_id: WORKFLOW_NODE_IDS.GENERAL,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.DETAILED_LOOKUP },
      condition: llmEdgeCondition(
        "The caller asks for specific detailed technical, product, warranty, or document-based information not answered by basic company overview.",
      ),
    },
    {
      id: "e_general_human",
      start_node_id: WORKFLOW_NODE_IDS.GENERAL,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.HUMAN },
      condition: llmEdgeCondition("The caller wants to speak with a person, agent, or human."),
    },
    {
      id: "e_general_closing",
      start_node_id: WORKFLOW_NODE_IDS.GENERAL,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.CLOSING },
      condition: llmEdgeCondition("The caller is clearly saying goodbye and ending the call."),
    },
    {
      id: "e_action_general",
      start_node_id: WORKFLOW_NODE_IDS.ACTION,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.GENERAL },
      condition: llmEdgeCondition(
        "The caller changed subject to a general business question not about sending a link.",
      ),
    },
    {
      id: "e_action_recovery_not_configured",
      start_node_id: WORKFLOW_NODE_IDS.ACTION,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.RECOVERY },
      condition: expressionEdgeCondition(
        exprVarEqualsString("resource_send_status", "not_configured"),
      ),
    },
    {
      id: "e_action_recovery_failed",
      start_node_id: WORKFLOW_NODE_IDS.ACTION,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.RECOVERY },
      condition: expressionEdgeCondition(
        exprVarEqualsString("resource_send_status", "temporarily_unavailable"),
      ),
    },
    {
      id: "e_action_general_consent",
      start_node_id: WORKFLOW_NODE_IDS.ACTION,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.GENERAL },
      condition: expressionEdgeCondition(
        exprVarEqualsString("resource_send_status", "consent_required"),
      ),
    },
    {
      id: "e_lookup_general",
      start_node_id: WORKFLOW_NODE_IDS.DETAILED_LOOKUP,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.GENERAL },
      condition: llmEdgeCondition("The detailed question has been answered or the caller moved on."),
    },
    {
      id: "e_human_recovery",
      start_node_id: WORKFLOW_NODE_IDS.HUMAN,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.RECOVERY },
      condition: expressionEdgeCondition(exprVarEqualsBool("transfer_available", false)),
    },
    {
      id: "e_recovery_general",
      start_node_id: WORKFLOW_NODE_IDS.RECOVERY,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.GENERAL },
      condition: llmEdgeCondition("The caller has a new general question or changed subject."),
    },
    {
      id: "e_recovery_closing",
      start_node_id: WORKFLOW_NODE_IDS.RECOVERY,
      target: { type: "node", node_id: WORKFLOW_NODE_IDS.CLOSING },
      condition: llmEdgeCondition("The caller is done and ready to end the call."),
    },
  ];

  return {
    start_node_id: WORKFLOW_NODE_IDS.GENERAL,
    nodes,
    edges,
  };
}

export function workflowNodeExpectedTools(
  nodeId: string,
  toolIds: WorkflowSharedToolIds,
): string[] {
  switch (nodeId) {
    case WORKFLOW_NODE_IDS.GENERAL:
    case WORKFLOW_NODE_IDS.RECOVERY:
      return [];
    case WORKFLOW_NODE_IDS.ACTION:
      return toolIds.sendResource ? ["send_resource"] : [];
    case WORKFLOW_NODE_IDS.DETAILED_LOOKUP:
      return [
        ...(toolIds.searchDetails ? ["search_business_details"] : []),
        ...(toolIds.retrieval ? ["retrieval"] : []),
      ];
    case WORKFLOW_NODE_IDS.HUMAN:
      return toolIds.transfer ? ["transfer"] : [];
    case WORKFLOW_NODE_IDS.CLOSING:
      return toolIds.hangup ? ["hangup"] : [];
    default:
      return [];
  }
}
