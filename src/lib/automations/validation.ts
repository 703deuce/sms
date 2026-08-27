import type { AutomationCanvasNode, AutomationDefinition } from "./types";
import { findTriggerNode, getOutgoingEdges, hasCycle } from "./types";
import { isConditionBlock } from "./catalog";
import { getAutomationCapabilities } from "./capabilities";
import { isVoiceAutomationBlock } from "./block-scope";

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
  const caps = getAutomationCapabilities();

  if (!name.trim()) {
    issues.push({ message: "Automation name is required", severity: "error" });
  }

  if (hasCycle(def)) {
    issues.push({ message: "Workflow contains a loop — remove circular connections", severity: "error" });
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
    if (trigger.data.blockType === "scheduled_datetime") {
      const runAt = String(trigger.data.config?.runAt || "").trim();
      if (!runAt) {
        issues.push({
          nodeId: trigger.id,
          message: "Scheduled trigger requires a date and time",
          severity: "error",
        });
      }
    }
    if (trigger.data.blockType === "inbound_call") {
      const phoneNumberId = String(trigger.data.config?.phoneNumberId || "").trim();
      if (!phoneNumberId) {
        issues.push({
          nodeId: trigger.id,
          message: "Inbound Call trigger requires a phone number",
          severity: "error",
        });
      }
    }
    if (trigger.data.blockType === "tag_added") {
      const tag = String(trigger.data.config?.tag || "").trim();
      if (!tag) {
        issues.push({
          nodeId: trigger.id,
          message: "Select a tag for the tag-added trigger",
          severity: "error",
        });
      }
    }
  }

  for (const node of def.nodes) {
    const block = node.data.blockType;
    const cfg = node.data.config || {};

    if (isVoiceAutomationBlock(block) && !caps.voice) {
      issues.push({
        nodeId: node.id,
        message: "Voice call blocks are not available in the SMS automation builder",
        severity: "error",
      });
    }

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

    if (block === "send_email") {
      if (!caps.email) {
        issues.push({
          nodeId: node.id,
          message: "Email is not configured (set BREVO_API_KEY to publish email steps)",
          severity: "error",
        });
      }
      if (!String(cfg.subject || "").trim()) {
        issues.push({ nodeId: node.id, message: "Email subject is required", severity: "error" });
      }
      if (!String(cfg.body || "").trim()) {
        issues.push({ nodeId: node.id, message: "Email body is required", severity: "error" });
      }
    }

    if ((block === "send_sms" || block === "send_review_request") && !caps.sms) {
      issues.push({
        nodeId: node.id,
        message: "SMS sending is paused or unavailable for this account",
        severity: "error",
      });
    }

    if (block === "send_webhook") {
      const url = String(cfg.url || "").trim();
      if (!url) {
        issues.push({ nodeId: node.id, message: "Webhook URL is required", severity: "error" });
      }
    }

    if (block === "enroll_in_automation" || block === "remove_from_automation") {
      if (!String(cfg.flowId || "").trim()) {
        issues.push({ nodeId: node.id, message: "Select an automation flow", severity: "error" });
      }
    }

    if (block === "wait") {
      const weeks = Number(cfg.weeks || 0);
      const days = Number(cfg.days || 0);
      const hours = Number(cfg.hours || 0);
      const minutes = Number(cfg.minutes || 0);
      if (weeks + days + hours + minutes <= 0) {
        issues.push({
          nodeId: node.id,
          message: "Set a valid wait duration",
          severity: "error",
        });
      }
    }

    if (block === "wait_until_datetime") {
      const runAt = String(cfg.runAt || "").trim();
      const timeOfDay = String(cfg.timeOfDay || "").trim();
      if (!runAt && !timeOfDay) {
        issues.push({
          nodeId: node.id,
          message: "Set a wait-until date/time",
          severity: "error",
        });
      }
    }

    if (isConditionBlock(block)) {
      const yesEdge = def.edges.some((e) => e.source === node.id && e.sourceHandle === "yes");
      const noEdge = def.edges.some((e) => e.source === node.id && e.sourceHandle === "no");
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
      if (!isConditionBlock(block) && out.length === 0) {
        issues.push({
          nodeId: node.id,
          message: `"${node.data.label}" is not connected to the next step`,
          severity: "warning",
        });
      }
    }

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
        config: { days: 3, hours: 0, minutes: 0, weeks: 0 },
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
