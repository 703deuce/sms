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
import { listWorkflowDrafts } from "@/lib/agents/appointment-booking/workflow-architect";

export async function activateAgentVersion(input: {
  workspaceId: string;
  agentId: string;
  userId: string;
  confirm: boolean;
  changeLog?: string;
}) {
  if (!input.confirm) {
    throw new Error("confirm:true is required to activate a production version");
  }
  const published = await publishVoiceAgent(
    input.workspaceId,
    input.agentId,
    input.changeLog || "agent_control_activate",
  );
  await getPrisma().auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.version_activated",
      detail: `agent=${input.agentId}`,
    },
  });
  return { ok: true, agent: published };
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
  await getPrisma().auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.version_rolled_back",
      detail: `agent=${input.agentId} version=${input.versionId}`,
    },
  });
  return { ok: true, agent: rolled };
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
  const copy = await duplicateVoiceAgent(input.workspaceId, input.agentId);
  if (input.name?.trim()) {
    await getPrisma().voiceAgent.update({
      where: { id: copy.id },
      data: {
        name: input.name.trim(),
        displayName: input.name.trim(),
      },
    });
  }
  await getPrisma().auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      event: "agent.duplicated",
      detail: `from=${input.agentId} to=${copy.id}`,
    },
  });
  return {
    ok: true,
    agentId: copy.id,
    name: input.name?.trim() || copy.name,
    status: "draft",
    note: "Duplicate created as DRAFT with no phone number. Connect resources before activation.",
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
