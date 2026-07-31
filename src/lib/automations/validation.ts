import type { AutomationCanvasNode, AutomationDefinition } from "./types";
import { findTriggerNode, getOutgoingEdges } from "./types";

export type ValidationIssue = {
  nodeId?: string;
  message: string;
  severity: "error" | "warning";
};

export function validateAutomationForPublish(
  name: string,
  def: AutomationDefinition,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!name.trim()) {
    issues.push({ message: "Automation name is required", severity: "error" });
  }

  const triggers = def.nodes.filter((n) => n.type === "trigger");
  if (triggers.length === 0) {
    issues.push({ message: "Add a trigger block at the start of the flow", severity: "error" });
  } else if (triggers.length > 1) {
    issues.push({
      nodeId: triggers[1].id,
      message: "Only one trigger is allowed per automation",
      severity: "error",
    });
  }

  const trigger = findTriggerNode(def);
  if (trigger) {
    const out = getOutgoingEdges(def, trigger.id);
    if (out.length === 0) {
      issues.push({
        nodeId: trigger.id,
        message: "Connect the trigger to the next step",
        severity: "error",
      });
    }
  }

  for (const node of def.nodes) {
    const block = node.data.blockType;
    const cfg = node.data.config || {};

    if (block === "send_sms" || block === "send_review_request") {
      const body = String(cfg.body || "").trim();
      if (!body) {
        issues.push({
          nodeId: node.id,
          message: "SMS message body is required",
          severity: "error",
        });
      }
    }

    if (block === "wait") {
      const days = Number(cfg.days || 0);
      const hours = Number(cfg.hours || 0);
      const minutes = Number(cfg.minutes || 0);
      if (days + hours + minutes <= 0) {
        issues.push({
          nodeId: node.id,
          message: "Set a valid wait duration",
          severity: "error",
        });
      }
    }

    if (block === "condition" || node.type === "logic" && block === "condition") {
      const yesEdge = def.edges.some(
        (e) => e.source === node.id && e.sourceHandle === "yes",
      );
      const noEdge = def.edges.some(
        (e) => e.source === node.id && e.sourceHandle === "no",
      );
      if (!yesEdge || !noEdge) {
        issues.push({
          nodeId: node.id,
          message: "Condition must have both Yes and No branches connected",
          severity: "error",
        });
      }
    }

    if (node.type !== "end" && block !== "end_automation") {
      const out = getOutgoingEdges(def, node.id);
      const isCondition = block === "condition";
      if (!isCondition && out.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `"${node.data.label}" is not connected to the next step`,
          severity: "warning",
        });
      }
    }

    // Self-loop check
    for (const edge of def.edges) {
      if (edge.source === edge.target) {
        issues.push({
          nodeId: edge.source,
          message: "A node cannot connect to itself",
          severity: "error",
        });
      }
    }
  }

  // Disconnected nodes (except trigger if alone)
  const connectedIds = new Set<string>();
  for (const e of def.edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  }
  for (const node of def.nodes) {
    if (!connectedIds.has(node.id) && def.nodes.length > 1) {
      issues.push({
        nodeId: node.id,
        message: `"${node.data.label}" is disconnected from the flow`,
        severity: "warning",
      });
    }
  }

  return issues;
}

export function hasBlockingErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

export function defaultMvpDefinition(): AutomationDefinition {
  const triggerId = "trigger_1";
  const action1Id = "action_review";
  const waitId = "wait_1";
  const conditionId = "condition_1";
  const endYesId = "end_yes";
  const followupId = "action_followup";
  const endNoId = "end_no";

  const nodes: AutomationCanvasNode[] = [
    {
      id: triggerId,
      type: "trigger",
      position: { x: 250, y: 0 },
      data: {
        blockType: "customer_added",
        label: "Customer added",
        config: {},
      },
    },
    {
      id: action1Id,
      type: "action",
      position: { x: 250, y: 120 },
      data: {
        blockType: "send_review_request",
        label: "Send review request",
        config: {
          body: "Hi {{customer.firstName}}, we'd love your feedback! Leave a review: {{reviewLink}}",
          stopOnReply: true,
        },
      },
    },
    {
      id: waitId,
      type: "logic",
      position: { x: 250, y: 240 },
      data: {
        blockType: "wait",
        label: "Wait",
        config: { days: 3, hours: 0, minutes: 0 },
      },
    },
    {
      id: conditionId,
      type: "logic",
      position: { x: 250, y: 360 },
      data: {
        blockType: "condition",
        label: "Condition",
        config: { field: "review_received", operator: "equals", value: "true" },
      },
    },
    {
      id: endYesId,
      type: "end",
      position: { x: 80, y: 500 },
      data: { blockType: "end_automation", label: "End automation", config: {} },
    },
    {
      id: followupId,
      type: "action",
      position: { x: 420, y: 500 },
      data: {
        blockType: "send_sms",
        label: "Send follow-up",
        config: {
          body: "Hi {{customer.firstName}}, just a friendly reminder — we'd still love your review: {{reviewLink}}",
        },
      },
    },
    {
      id: endNoId,
      type: "end",
      position: { x: 420, y: 620 },
      data: { blockType: "end_automation", label: "End automation", config: {} },
    },
  ];

  const edges = [
    { id: "e1", source: triggerId, target: action1Id, sourceHandle: "default" },
    { id: "e2", source: action1Id, target: waitId, sourceHandle: "default" },
    { id: "e3", source: waitId, target: conditionId, sourceHandle: "default" },
    { id: "e4", source: conditionId, target: endYesId, sourceHandle: "yes" },
    { id: "e5", source: conditionId, target: followupId, sourceHandle: "no" },
    { id: "e6", source: followupId, target: endNoId, sourceHandle: "default" },
  ];

  return { version: 1, nodes, edges, viewport: { x: 0, y: 0, zoom: 1 } };
}
