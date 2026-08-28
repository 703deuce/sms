/**
 * Seeds automation-builder graphs from Playbooks cards (engine: automation).
 */

import {
  EMPTY_DEFINITION,
  createEdgeId,
  createNodeId,
  type AutomationCanvasNode,
  type AutomationDefinition,
} from "@/lib/automations/types";
import { getBlock } from "@/lib/automations/catalog";
import {
  DEFAULT_MESSAGES,
  getCampaignCategory,
  type CampaignCategory,
  type CampaignCategoryId,
} from "./catalog";

export type CampaignPlaybookAutomationSpec = {
  categoryId: CampaignCategoryId;
  title: string;
  triggerBlockType: string;
  triggerConfig?: Record<string, unknown>;
  actions: Array<{ blockType: string; label: string; config?: Record<string, unknown> }>;
};

const PLAYBOOK_AUTOMATION_SPECS: Record<
  Extract<CampaignCategoryId, "missed_call" | "status_update" | "custom">,
  CampaignPlaybookAutomationSpec
> = {
  missed_call: {
    categoryId: "missed_call",
    title: "Reply to Missed Calls or Messages",
    triggerBlockType: "call_missed",
    actions: [
      {
        blockType: "send_sms",
        label: "Missed-call text back",
        config: { body: DEFAULT_MESSAGES.missed_call },
      },
      {
        blockType: "create_task",
        label: "Notify staff",
        config: { title: "Follow up missed call from {{customer.phone}}", dueInDays: 0 },
      },
    ],
  },
  status_update: {
    categoryId: "status_update",
    title: "Send Status Updates",
    triggerBlockType: "integration_order_updated",
    triggerConfig: { provider: "woocommerce", orderStatus: "" },
    actions: [
      {
        blockType: "send_sms",
        label: "Status update SMS",
        config: { body: DEFAULT_MESSAGES.status_update },
      },
    ],
  },
  custom: {
    categoryId: "custom",
    title: "Build a Custom Workflow",
    triggerBlockType: "inbound_call",
    actions: [],
  },
};

export function isCampaignPlaybookAutomationId(
  id: string | null | undefined,
): id is keyof typeof PLAYBOOK_AUTOMATION_SPECS {
  return Boolean(id && id in PLAYBOOK_AUTOMATION_SPECS);
}

export function getCampaignPlaybookAutomationSpec(
  id: string | null | undefined,
): CampaignPlaybookAutomationSpec | null {
  if (!isCampaignPlaybookAutomationId(id)) return null;
  return PLAYBOOK_AUTOMATION_SPECS[id];
}

export function getCampaignPlaybookAutomationCategory(
  id: string | null | undefined,
): CampaignCategory | undefined {
  const cat = getCampaignCategory(id);
  if (!cat || cat.engine !== "automation") return undefined;
  return cat;
}

function chainTriggerAndActions(spec: {
  triggerBlockType: string;
  triggerConfig?: Record<string, unknown>;
  actions: CampaignPlaybookAutomationSpec["actions"];
}): AutomationDefinition {
  const triggerBlock = getBlock(spec.triggerBlockType);
  const triggerId = createNodeId();
  const nodes: AutomationCanvasNode[] = [
    {
      id: triggerId,
      type: "trigger",
      position: { x: 260, y: 60 },
      data: {
        blockType: spec.triggerBlockType,
        label: triggerBlock?.label || spec.triggerBlockType,
        config: { ...(triggerBlock?.defaultConfig || {}), ...(spec.triggerConfig || {}) },
      },
    },
  ];
  const edges: AutomationDefinition["edges"] = [];

  let prevId = triggerId;
  spec.actions.forEach((action, idx) => {
    const block = getBlock(action.blockType);
    const category = block?.category;
    const type: AutomationCanvasNode["type"] =
      category === "end" ? "end" : category === "logic" ? "logic" : "action";
    const id = `${createNodeId()}_${idx}`;
    nodes.push({
      id,
      type,
      position: { x: 260, y: 200 + idx * 140 },
      data: {
        blockType: action.blockType,
        label: action.label || block?.label || action.blockType,
        config: { ...(block?.defaultConfig || {}), ...(action.config || {}) },
      },
    });
    edges.push({
      id: createEdgeId(),
      source: prevId,
      target: id,
      sourceHandle: "default",
      targetHandle: null,
    });
    prevId = id;
  });

  return {
    version: 1,
    nodes,
    edges,
    viewport: EMPTY_DEFINITION.viewport,
  };
}

/** Builder-ready graph for missed_call / status_update / custom playbooks. */
export function buildAutomationDefinitionFromCampaignPlaybook(
  categoryId: string,
): AutomationDefinition | null {
  const spec = getCampaignPlaybookAutomationSpec(categoryId);
  if (!spec) return null;
  return chainTriggerAndActions(spec);
}

export function campaignPlaybookAutomationName(categoryId: string): string | null {
  const spec = getCampaignPlaybookAutomationSpec(categoryId);
  return spec?.title ?? null;
}
