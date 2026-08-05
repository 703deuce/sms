import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";
import {
  agentTypeLabel,
  getAgentType,
} from "@/lib/agents/types";
import { resolvePrimaryFlowId } from "@/lib/agents/workflows";

export const runtime = "nodejs";

/**
 * Lightweight agent inventory for Use Agent / Start AI call pickers in the
 * visual flow builder. Includes voice agents and SMS solution setups that
 * own a primary workflow.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = await getActiveWorkspaceId();
  const prisma = getPrisma();

  const [agents, setups] = await Promise.all([
    prisma.voiceAgent.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        displayName: true,
        agentType: true,
        status: true,
        primaryFlowId: true,
        linkedAutomationIds: true,
        postCallAutomationId: true,
        fallbackAutomationId: true,
        executionType: true,
        sourceSolutionSetupId: true,
      },
    }),
    prisma.solutionSetup.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        name: true,
        solutionType: true,
        status: true,
        primaryFlowId: true,
        linkedAutomationIds: true,
        linkedAgentIds: true,
        configJson: true,
      },
    }),
  ]);

  const voiceIdsWithSetup = new Set(
    setups.flatMap((s: { linkedAgentIds: string[] }) => s.linkedAgentIds || []),
  );

  const items: Array<{
    id: string;
    kind: "voice" | "setup";
    name: string;
    agentType: string;
    agentTypeLabel: string;
    channel: string;
    primaryFlowId: string | null;
    agentId: string | null;
    setupId: string | null;
    status: string;
  }> = [];

  for (const setup of setups) {
    const cfg = setup.configJson as { agentType?: string; outcomeSlug?: string } | null;
    const typeId =
      cfg?.agentType ||
      (setup.solutionType === "appointment-receptionist"
        ? "appointment_booking"
        : setup.solutionType === "missed-call-text-back"
          ? "missed_call_text_back"
          : "custom");
    const type = getAgentType(String(typeId));
    const primaryFlowId = resolvePrimaryFlowId({
      primaryFlowId: setup.primaryFlowId,
      linkedAutomationIds: setup.linkedAutomationIds,
    });
    items.push({
      id: `setup:${setup.id}`,
      kind: "setup",
      name: setup.name,
      agentType: type.id,
      agentTypeLabel: type.label,
      channel: type.channel,
      primaryFlowId,
      agentId: setup.linkedAgentIds?.[0] || null,
      setupId: setup.id,
      status: setup.status,
    });
  }

  for (const agent of agents) {
    // Prefer the setup card when this voice agent is already represented.
    if (agent.sourceSolutionSetupId || voiceIdsWithSetup.has(agent.id)) {
      continue;
    }
    const type = getAgentType(agent.agentType);
    items.push({
      id: `voice:${agent.id}`,
      kind: "voice",
      name: agent.displayName || agent.name,
      agentType: type.id,
      agentTypeLabel: agentTypeLabel(type.id),
      channel: type.channel,
      primaryFlowId: resolvePrimaryFlowId({
        primaryFlowId: agent.primaryFlowId,
        linkedAutomationIds: agent.linkedAutomationIds,
        postCallAutomationId: agent.postCallAutomationId,
        fallbackAutomationId: agent.fallbackAutomationId,
      }),
      agentId: agent.id,
      setupId: agent.sourceSolutionSetupId,
      status: agent.status,
    });
  }

  return NextResponse.json({ data: items });
}
