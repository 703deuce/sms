/**
 * Read-only retrieval tools for the Workflow Architect LLM.
 */

import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import type { LlmToolDefinition } from "@/lib/ai/llm-tools";
import {
  getAvailableWorkflowBlocks,
  getWorkflowBlockDefinition,
  WORKFLOW_BLOCK_CATALOG_VERSION,
} from "./workflow-block-catalog";
import { listWorkflowDrafts } from "@/lib/agents/appointment-booking/workflow-architect";
import { architectWorkflowFromRequest } from "@/lib/agents/appointment-booking/workflow-architect";
import { generateWorkflowTestPlan } from "./workflow-test-plan";
import { APPOINTMENT_BOOKING_TEST_SCENARIOS } from "@/lib/agents/appointment-booking/test-suite";
import { stringifyToolResult, toolCompleted, type ToolResult } from "./tool-result";

const OBJECT = (props: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties: props,
  required,
  additionalProperties: false,
});

export const WORKFLOW_ARCHITECT_READ_TOOLS: LlmToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_current_workflow",
      description: "Return the current primary workflow draft graph or default template.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_block_catalog",
      description: "Return all available approved workflow blocks with metadata.",
      parameters: OBJECT({ includeUnavailable: { type: "boolean" } }),
    },
  },
  {
    type: "function",
    function: {
      name: "get_block_definition",
      description: "Return detailed metadata for one block type.",
      parameters: OBJECT({ blockType: { type: "string" } }, ["blockType"]),
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_profile",
      description: "Return booking profile, timezone, and capability summary.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_booking_policy",
      description: "Return active booking policy rules.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_collection_fields",
      description: "Return configured collection fields.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_agent_resources",
      description: "Return phone, calendar, workflow, and transfer destinations.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_transfer_destinations",
      description: "Return staff transfer destinations (e.g. Marcus).",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_service_catalog",
      description: "Return bookable services.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_workflow_templates",
      description: "Return validated template recipe keys for known patterns.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "get_workflow_test_catalog",
      description: "Return available regression scenario ids.",
      parameters: OBJECT({}),
    },
  },
  {
    type: "function",
    function: {
      name: "submit_workflow_draft",
      description:
        "Submit the final structured workflow draft result. Call once when ready.",
      parameters: OBJECT({
        status: {
          type: "string",
          enum: ["draft_created", "needs_information", "unsupported"],
        },
        summary: { type: "string" },
        interpretation: { type: "string" },
        name: { type: "string" },
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              config: { type: "object" },
            },
            required: ["id", "type"],
          },
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fromNodeId: { type: "string" },
              toNodeId: { type: "string" },
              condition: { type: "string" },
            },
            required: ["fromNodeId", "toNodeId"],
          },
        },
        triggerNodeId: { type: "string" },
        assumptions: { type: "array", items: { type: "string" } },
        missingInformation: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              question: { type: "string" },
              reason: { type: "string" },
            },
          },
        },
        unsupportedRequirements: { type: "array", items: { type: "string" } },
        nearestSupportedAlternative: { type: "string" },
        reason: { type: "string" },
      }, ["status", "summary"]),
    },
  },
];

export type WorkflowArchitectToolContext = {
  workspaceId: string;
  agentId: string;
  userId: string;
  userRequest: string;
  agent: AppointmentBookingAgentView;
  draftConfig?: unknown;
  phoneNumberId?: string | null;
  timezone?: string;
};

export async function executeWorkflowArchitectTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: WorkflowArchitectToolContext,
): Promise<ToolResult> {
  switch (toolName) {
    case "get_current_workflow": {
      const drafts = listWorkflowDrafts(ctx.draftConfig);
      const active = drafts.find((d) => d.status === "draft" || d.status === "ready_for_test");
      if (active) {
        return toolCompleted({
          draftId: active.id,
          name: active.name,
          triggerNodeId: active.triggerNodeId,
          nodeCount: active.nodes.length,
          edgeCount: active.edges.length,
          nodes: active.nodes,
          edges: active.edges,
        });
      }
      const template = architectWorkflowFromRequest({
        agentId: ctx.agentId,
        userRequest: ctx.userRequest,
        phoneNumberId: ctx.phoneNumberId,
        timezone: ctx.timezone,
      });
      return toolCompleted({
        source: "default_template",
        name: template.name,
        triggerNodeId: template.triggerNodeId,
        nodeCount: template.nodes.length,
        nodes: template.nodes.map((n) => ({ id: n.id, type: n.type })),
        edges: template.edges,
      });
    }
    case "get_block_catalog":
      return toolCompleted({
        version: WORKFLOW_BLOCK_CATALOG_VERSION,
        blocks: getAvailableWorkflowBlocks(),
      });
    case "get_block_definition": {
      const def = getWorkflowBlockDefinition(String(args.blockType || ""));
      if (!def) return toolCompleted({ notFound: true, blockType: args.blockType });
      return toolCompleted(def);
    }
    case "get_agent_profile":
      return toolCompleted({
        timezone: ctx.agent.profile.timezone,
        bookingMode: ctx.agent.profile.bookingMode,
        canBook: ctx.agent.profile.canBook,
        requireFinalConfirmation: ctx.agent.profile.requireFinalConfirmation,
      });
    case "get_booking_policy":
      return toolCompleted(ctx.agent.bookingPolicy);
    case "get_collection_fields":
      return toolCompleted({
        requiredFields: ctx.agent.profile.requiredFields,
        businessServices: ctx.agent.businessBrain.services,
      });
    case "get_agent_resources":
      return toolCompleted({
        numberLabel: ctx.agent.resources.numberLabel,
        calendarLabel: ctx.agent.resources.calendarLabel,
        workflowLabel: ctx.agent.resources.workflowLabel,
        phoneNumberE164: ctx.agent.phoneNumberE164,
        transferDestinations: ctx.agent.businessBrain.transferDestinations,
      });
    case "get_transfer_destinations":
      return toolCompleted({
        destinations: ctx.agent.businessBrain.transferDestinations,
        staff: ctx.agent.businessBrain.staff,
      });
    case "get_service_catalog":
      return toolCompleted({
        services: ctx.agent.businessBrain.services,
        allowedServices: ctx.agent.bookingPolicy.allowedServices,
      });
    case "get_workflow_templates":
      return toolCompleted({
        templates: [
          "after_hours_emergency_transfer",
          "after_hours_booking",
          "standard_booking",
          "unsuccessful_booking_followup_sms",
        ],
      });
    case "get_workflow_test_catalog":
      return toolCompleted({
        scenarios: APPOINTMENT_BOOKING_TEST_SCENARIOS.map((s) => s.id),
      });
    default:
      return toolCompleted({ error: `Unknown tool: ${toolName}` });
  }
}

export function parseSubmitWorkflowDraftArgs(
  args: Record<string, unknown>,
): Record<string, unknown> {
  return args;
}

export { stringifyToolResult };
