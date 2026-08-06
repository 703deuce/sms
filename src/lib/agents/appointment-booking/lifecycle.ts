/**
 * Activate / rollback / duplicate helpers for Appointment Booking Agent.
 */

import { getPrisma } from "@/lib/db";
import {
  duplicateVoiceAgent,
  publishVoiceAgent,
  rollbackVoiceAgent,
  buildVoiceAgentForTest,
} from "@/lib/voice/agent-service";
import {
  activateFlowTriggers,
  pauseFlowTriggers,
} from "@/lib/automations/trigger-deployments";
import { listWorkflowDrafts } from "@/lib/agents/appointment-booking/workflow-architect";

async function activatePrimaryFlowTriggers(
  workspaceId: string,
  agentId: string,
) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: agentId, workspaceId },
  });
  if (!agent?.primaryFlowId) {
    return { activated: false, reason: "no_primary_flow" as const };
  }
  const flow = await prisma.automationFlow.findFirst({
    where: { id: agent.primaryFlowId, workspaceId },
  });
  if (!flow) return { activated: false, reason: "flow_missing" as const };

  const result = await activateFlowTriggers(
    workspaceId,
    flow.id,
    flow.definition,
    { forceTakeover: true },
  );
  await prisma.automationFlow.update({
    where: { id: flow.id },
    data: { status: "ACTIVE" },
  });
  return { activated: true, result };
}

export async function activateAgentVersion(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  confirm: boolean;
  changeLog?: string;
  skipSimulationGate?: boolean;
}) {
  if (!input.confirm) {
    throw new Error("confirm:true is required to activate a production version");
  }

  if (!input.skipSimulationGate) {
    const { runSimulationSuite } = await import(
      "@/lib/agents/appointment-booking/simulation"
    );
    const sim = runSimulationSuite();
    const critical = ["new_caller_books", "hold_then_book", "tomorrow_at_five"];
    const criticalFailed = sim.results.filter(
      (r) => critical.includes(r.scenarioId) && !r.passed,
    );
    if (criticalFailed.length) {
      throw new Error(
        `Activation blocked: critical simulation failures — ${criticalFailed
          .map((f) => f.scenarioId)
          .join(", ")}`,
      );
    }
  }

  const published = await publishVoiceAgent(
    input.workspaceId,
    input.agentId,
    input.changeLog || "agent_control_activate",
  );
  const triggers = await activatePrimaryFlowTriggers(
    input.workspaceId,
    input.agentId,
  ).catch((err) => ({
    activated: false as const,
    reason: "trigger_error" as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  await getPrisma().auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.version_activated",
      detail: `agent=${input.agentId} triggers=${JSON.stringify(triggers).slice(0, 300)}`,
    },
  });
  return { ok: true, agent: published, triggers };
}

export async function pauseAppointmentAgent(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  let pauseResult = null;
  if (agent.primaryFlowId) {
    pauseResult = await pauseFlowTriggers(
      input.workspaceId,
      agent.primaryFlowId,
    );
    await prisma.automationFlow.update({
      where: { id: agent.primaryFlowId },
      data: { status: "PAUSED" },
    }).catch(() => undefined);
  }

  await prisma.voiceAgent.update({
    where: { id: input.agentId },
    data: { status: "PAUSED" },
  });
  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.pause",
      detail: `agent=${input.agentId}`,
    },
  });
  return { ok: true, status: "paused", pauseResult };
}

export async function resumeAppointmentAgent(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
}) {
  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");

  await prisma.voiceAgent.update({
    where: { id: input.agentId },
    data: { status: "ACTIVE" },
  });

  const triggers = await activatePrimaryFlowTriggers(
    input.workspaceId,
    input.agentId,
  ).catch((err) => ({
    activated: false as const,
    reason: "trigger_error" as const,
    error: err instanceof Error ? err.message : String(err),
  }));

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.resume",
      detail: `agent=${input.agentId}`,
    },
  });
  return { ok: true, status: "active", triggers };
}

export async function rollbackAgentVersion(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  versionId: string;
  confirm: boolean;
}) {
  if (!input.confirm) {
    throw new Error("confirm:true is required to rollback a production version");
  }
  const rolled = await rollbackVoiceAgent(
    input.workspaceId,
    input.agentId,
    input.versionId,
  );
  const triggers = await activatePrimaryFlowTriggers(
    input.workspaceId,
    input.agentId,
  ).catch((err) => ({
    activated: false as const,
    reason: "trigger_error" as const,
    error: err instanceof Error ? err.message : String(err),
  }));
  await getPrisma().auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.version_rolled_back",
      detail: `agent=${input.agentId} version=${input.versionId}`,
    },
  });
  return { ok: true, agent: rolled, triggers };
}

export async function snapshotAgentForTest(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
}) {
  const built = await buildVoiceAgentForTest(input.workspaceId, input.agentId);
  await getPrisma().auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.test_snapshot",
      detail: `agent=${input.agentId}`,
    },
  });
  return { ok: true, agent: built };
}

export async function duplicateAppointmentAgent(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  name?: string;
  confirm: boolean;
}) {
  if (!input.confirm) {
    throw new Error("confirm:true is required to duplicate an agent");
  }
  const prisma = getPrisma();
  const source = await prisma.voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!source) throw new Error("Agent not found");

  const copy = await duplicateVoiceAgent(input.workspaceId, input.agentId);
  const name = input.name?.trim() || `${source.name} (copy)`;
  await prisma.voiceAgent.update({
    where: { id: copy.id },
    data: {
      name,
      displayName: name,
      // Copy resource links except phone (must be assigned before live).
      linkedCalendarIds: source.linkedCalendarIds || [],
      linkedAutomationIds: [],
      primaryFlowId: null,
      phoneNumberId: null,
      linkedPhoneNumberIds: [],
      status: "DRAFT",
    },
  });

  // Clone primary workflow graph as DRAFT if present.
  let clonedFlowId: string | null = null;
  if (source.primaryFlowId) {
    const flow = await prisma.automationFlow.findFirst({
      where: { id: source.primaryFlowId, workspaceId: input.workspaceId },
    });
    if (flow) {
      const cloned = await prisma.automationFlow.create({
        data: {
          workspaceId: input.workspaceId,
          name: `${name} — Primary`,
          description: `Cloned from ${source.primaryFlowId}`,
          status: "DRAFT",
          definition: flow.definition as object,
          ownerAgentId: copy.id,
          sourceSolutionSetupId: source.sourceSolutionSetupId,
        },
      });
      clonedFlowId = cloned.id;
      await prisma.voiceAgent.update({
        where: { id: copy.id },
        data: {
          primaryFlowId: cloned.id,
          linkedAutomationIds: [cloned.id],
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.duplicated",
      detail: `from=${input.agentId} to=${copy.id} flow=${clonedFlowId || "none"}`,
    },
  });
  return {
    ok: true,
    agentId: copy.id,
    name,
    status: "draft",
    primaryFlowId: clonedFlowId,
    note: "Duplicate created as DRAFT with calendars copied but no phone number. Connect a number before activation.",
    href: `/agents/${copy.id}`,
  };
}

export async function getPendingOperatingDrafts(input: {
  workspaceId: string;
  agentId: string;
}) {
  const agent = await getPrisma().voiceAgent.findFirst({
    where: { id: input.agentId, workspaceId: input.workspaceId },
  });
  if (!agent) throw new Error("Agent not found");
  return {
    workflowDrafts: listWorkflowDrafts(agent.draftConfig),
  };
}
