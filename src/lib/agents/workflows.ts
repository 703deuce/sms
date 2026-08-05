/**
 * Agent ↔ Workflow contract.
 *
 * Separation (see architecture.ts):
 *   Agent      — reusable worker; NOT defined by its trigger
 *   Workflow   — when it runs; which agents/actions; branches
 *   Deployment — number / audience / calendar / live status
 *   Trigger    — belongs on the workflow, not agent identity
 *
 * Every completed Outcome wizard creates:
 * 1. One typed agent (VoiceAgent and/or SolutionSetup)
 * 2. One versioned AutomationFlow (primary workflow)
 * 3. Two-way link: agent.primaryFlowId ↔ flow.ownerAgentId / sourceSolutionSetupId
 *
 * Wizard edits update only template_managed nodes (by templateNodeKey / stable id).
 * Custom nodes are preserved. Live voice turns stay on Telnyx — workflows wrap events.
 */

import { getPrisma } from "@/lib/db";
import type { AgentTypeId } from "@/lib/agents/types";
import {
  getAgentType,
  agentTypeFromOutcomeSlug,
} from "@/lib/agents/types";
import type {
  AutomationCanvasNode,
  AutomationDefinition,
  NodeOrigin,
} from "@/lib/automations/types";
import { parseAutomationDefinition } from "@/lib/automations/types";

export type FlowOwnershipKind = "agent_workflow" | "standalone";

export type ExecutionType =
  | "realtime_voice"
  | "event_driven_sms"
  | "scheduled_messaging"
  | "workflow_agent"
  | "campaign";

export function executionTypeForAgentType(
  agentType: AgentTypeId | string | null | undefined,
): ExecutionType {
  const def = getAgentType(agentType);
  switch (def.family) {
    case "receptionist":
      return "realtime_voice";
    case "sms":
      if (def.id === "appointment_reminders") return "scheduled_messaging";
      if (def.id === "review_request") return "workflow_agent";
      return "event_driven_sms";
    case "campaign":
      return "campaign";
    default:
      return "workflow_agent";
  }
}

/** Meaningful flow name for wizard-generated agent workflows. */
export function agentWorkflowName(agentName: string): string {
  const trimmed = agentName.trim() || "Agent";
  if (/workflow$/i.test(trimmed)) return trimmed;
  return `${trimmed} Workflow`;
}

export function stampManagedNode(
  node: AutomationCanvasNode,
  templateNodeKey: string,
  origin: NodeOrigin = "template_managed",
): AutomationCanvasNode {
  return {
    ...node,
    data: {
      ...node.data,
      origin,
      templateNodeKey,
    },
  };
}

/** Stamp origin + templateNodeKey from a map of nodeId → key. */
export function stampManagedDefinition(
  definition: AutomationDefinition,
  keyByNodeId: Record<string, string>,
): AutomationDefinition {
  return {
    ...definition,
    nodes: definition.nodes.map((node) => {
      const key = keyByNodeId[node.id];
      if (!key) {
        // Preserve existing custom stamps; default unknown nodes to custom.
        if (node.data.origin) return node;
        return {
          ...node,
          data: { ...node.data, origin: "custom" as const },
        };
      }
      return stampManagedNode(node, key, "template_managed");
    }),
  };
}

export type LinkAgentWorkflowInput = {
  workspaceId: string;
  flowId: string;
  agentName: string;
  ownerLabel: string;
  ownerAgentId?: string | null;
  solutionSetupId?: string | null;
  agentType?: string | null;
};

/**
 * Mark a flow as an agent workflow and mirror primaryFlowId on setup/agent.
 * Does not activate the flow.
 */
export async function linkAgentWorkflow(
  input: LinkAgentWorkflowInput,
): Promise<void> {
  const prisma = getPrisma();
  const now = new Date();
  const name = agentWorkflowName(input.agentName);

  await prisma.automationFlow.update({
    where: { id: input.flowId },
    data: {
      name,
      ownershipKind: "agent_workflow",
      ownerLabel: input.ownerLabel,
      ownerAgentId: input.ownerAgentId || null,
      ...(input.solutionSetupId
        ? { sourceSolutionSetupId: input.solutionSetupId }
        : {}),
      ...(input.ownerAgentId ? { linkedAgentIds: [input.ownerAgentId] } : {}),
      updatedAt: now,
    },
  });

  if (input.solutionSetupId) {
    await prisma.solutionSetup.update({
      where: { id: input.solutionSetupId },
      data: {
        primaryFlowId: input.flowId,
        linkedAutomationIds: [input.flowId],
        updatedAt: now,
      },
    });
  }

  if (input.ownerAgentId) {
    const executionType = executionTypeForAgentType(
      input.agentType || undefined,
    );
    await prisma.voiceAgent.update({
      where: { id: input.ownerAgentId },
      data: {
        primaryFlowId: input.flowId,
        executionType,
        linkedAutomationIds: [input.flowId],
        updatedAt: now,
      },
    });
  }
}

/**
 * Backfill ownership for flows that were generated from solutions but lack
 * ownershipKind / primaryFlowId links. Does not activate flows.
 */
export async function backfillAgentWorkflows(
  workspaceId: string,
): Promise<number> {
  const prisma = getPrisma();
  const flows = await prisma.automationFlow.findMany({
    where: { workspaceId },
    select: {
      id: true,
      name: true,
      description: true,
      ownershipKind: true,
      ownerLabel: true,
      ownerAgentId: true,
      sourceSolutionSetupId: true,
      linkedAgentIds: true,
    },
  });

  let touched = 0;
  for (const flow of flows) {
    const generated =
      Boolean(flow.sourceSolutionSetupId) ||
      (typeof flow.description === "string" &&
        flow.description.startsWith("Generated from "));
    if (!generated && flow.ownershipKind === "agent_workflow") {
      // Already labeled; ensure primary links if possible.
    } else if (!generated) {
      continue;
    }

    const ownerLabel =
      flow.ownerLabel ||
      (flow.description?.startsWith("Generated from ")
        ? flow.description.replace(/^Generated from\s+/, "").trim()
        : null) ||
      flow.name;

    const ownerAgentId =
      flow.ownerAgentId || flow.linkedAgentIds?.[0] || null;

    await prisma.automationFlow.update({
      where: { id: flow.id },
      data: {
        ownershipKind: "agent_workflow",
        ownerLabel,
        ownerAgentId,
        name:
          flow.name === "Untitled automation"
            ? agentWorkflowName(ownerLabel)
            : flow.name,
        updatedAt: new Date(),
      },
    });

    if (flow.sourceSolutionSetupId) {
      await prisma.solutionSetup.update({
        where: { id: flow.sourceSolutionSetupId },
        data: {
          primaryFlowId: flow.id,
          updatedAt: new Date(),
        },
      });
    }

    if (ownerAgentId) {
      await prisma.voiceAgent.update({
        where: { id: ownerAgentId },
        data: {
          primaryFlowId: flow.id,
          updatedAt: new Date(),
        },
      });
    }

    touched += 1;
  }

  // Agents with linked automations but no primaryFlowId.
  const agents = await prisma.voiceAgent.findMany({
    where: { workspaceId, archivedAt: null, primaryFlowId: null },
    select: {
      id: true,
      linkedAutomationIds: true,
      postCallAutomationId: true,
      fallbackAutomationId: true,
      agentType: true,
    },
  });
  for (const agent of agents) {
    const flowId =
      agent.postCallAutomationId ||
      agent.fallbackAutomationId ||
      agent.linkedAutomationIds?.[0] ||
      null;
    if (!flowId) continue;
    await prisma.voiceAgent.update({
      where: { id: agent.id },
      data: {
        primaryFlowId: flowId,
        executionType: executionTypeForAgentType(agent.agentType),
        updatedAt: new Date(),
      },
    });
    touched += 1;
  }

  const setups = await prisma.solutionSetup.findMany({
    where: { workspaceId, primaryFlowId: null },
    select: { id: true, linkedAutomationIds: true, solutionType: true },
  });
  for (const setup of setups) {
    const flowId = setup.linkedAutomationIds?.[0];
    if (!flowId) continue;
    await prisma.solutionSetup.update({
      where: { id: setup.id },
      data: { primaryFlowId: flowId, updatedAt: new Date() },
    });
    touched += 1;
  }

  return touched;
}

export function workflowEditHref(flowId: string | null | undefined): string | null {
  if (!flowId) return null;
  return `/automations/${flowId}/edit`;
}

export function resolvePrimaryFlowId(input: {
  primaryFlowId?: string | null;
  linkedAutomationIds?: string[] | null;
  postCallAutomationId?: string | null;
  fallbackAutomationId?: string | null;
}): string | null {
  return (
    input.primaryFlowId ||
    input.postCallAutomationId ||
    input.fallbackAutomationId ||
    input.linkedAutomationIds?.[0] ||
    null
  );
}

/** Ensure definition nodes carry origin metadata when missing (for older graphs). */
export function ensureNodeOrigins(
  definition: unknown,
  managedKeys: Record<string, string>,
): AutomationDefinition {
  const def = parseAutomationDefinition(definition);
  return stampManagedDefinition(def, managedKeys);
}

export function ownerLabelForOutcome(
  outcomeSlug: string | null | undefined,
  fallbackName: string,
): string {
  const typeId = agentTypeFromOutcomeSlug(outcomeSlug);
  const label = getAgentType(typeId).label;
  return label === "Custom Agent" ? fallbackName : label;
}

/**
 * Merge template-managed nodes from `template` into an existing graph.
 * Custom / unknown nodes and their edges are preserved.
 * Managed nodes (by templateNodeKey or stable id) are updated from the template.
 */
export function reconcileManagedNodes(
  existing: unknown,
  template: AutomationDefinition,
  managedKeys: string[],
): AutomationDefinition {
  const keySet = new Set(managedKeys);
  const current = parseAutomationDefinition(existing);
  const templateByKey = new Map<string, (typeof template.nodes)[number]>();
  const templateById = new Map(
    template.nodes.map((n) => [n.id, n] as const),
  );

  for (const node of template.nodes) {
    const key = node.data.templateNodeKey;
    if (key) templateByKey.set(key, node);
  }

  const managedIds = new Set<string>();
  const nextNodes: typeof current.nodes = [];

  // Update or keep existing nodes.
  for (const node of current.nodes) {
    const key = node.data.templateNodeKey;
    const isManaged =
      (key && keySet.has(key)) ||
      templateById.has(node.id);

    if (isManaged) {
      const fromTemplate =
        (key ? templateByKey.get(key) : undefined) ||
        templateById.get(node.id);
      if (fromTemplate) {
        managedIds.add(fromTemplate.id);
        nextNodes.push({
          ...fromTemplate,
          // Keep user's canvas position if they moved a managed node.
          position: node.position || fromTemplate.position,
          data: {
            ...fromTemplate.data,
            origin: "template_managed",
            templateNodeKey:
              fromTemplate.data.templateNodeKey || key || undefined,
          },
        });
        continue;
      }
    }

    // Custom / unknown — preserve.
    nextNodes.push(node);
  }

  // Add any managed template nodes that were missing (e.g. call_outcome).
  for (const node of template.nodes) {
    const key = node.data.templateNodeKey;
    if (key && keySet.has(key) && !managedIds.has(node.id)) {
      const already = nextNodes.some(
        (n) =>
          n.id === node.id ||
          n.data.templateNodeKey === key,
      );
      if (!already) {
        nextNodes.push(node);
        managedIds.add(node.id);
      }
    }
  }

  // Rebuild managed edges from template; keep edges that touch custom nodes.
  const managedIdSet = new Set(
    nextNodes
      .filter(
        (n) =>
          (n.data.templateNodeKey &&
            keySet.has(n.data.templateNodeKey)) ||
          templateById.has(n.id),
      )
      .map((n) => n.id),
  );

  const customEdges = current.edges.filter(
    (e) => !managedIdSet.has(e.source) || !managedIdSet.has(e.target),
  );
  const templateManagedEdges = template.edges.filter(
    (e) => managedIdSet.has(e.source) && managedIdSet.has(e.target),
  );

  // Dedupe by id.
  const edgeById = new Map<string, (typeof template.edges)[number]>();
  for (const e of [...templateManagedEdges, ...customEdges]) {
    edgeById.set(e.id, e);
  }

  return {
    ...current,
    version: template.version || current.version,
    nodes: nextNodes,
    edges: [...edgeById.values()],
    viewport: current.viewport || template.viewport,
  };
}

