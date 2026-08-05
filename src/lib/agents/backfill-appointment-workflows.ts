/**
 * Backfill existing appointment-booking agents (e.g. Maya) onto the
 * agent_workflow + TriggerDeployment model without activating.
 */

import { getPrisma } from "@/lib/db";
import {
  ensureAgentPrimaryWorkflow,
  routingModeFromAnswerWhen,
  triggerBlockFromAnswerWhen,
} from "@/lib/agents/compile-workflow";
import { agentTypeFromOutcomeSlug } from "@/lib/agents/types";

export async function backfillAppointmentAgentWorkflows(
  workspaceId: string,
): Promise<{
  touched: number;
  results: Array<{
    agentId: string;
    setupId: string | null;
    flowId: string | null;
    phoneNumberId: string | null;
    activated: false;
    error?: string;
  }>;
}> {
  const prisma = getPrisma();
  const setups = await prisma.solutionSetup.findMany({
    where: {
      workspaceId,
      solutionType: "appointment-receptionist",
    },
    take: 50,
  });

  const results: Array<{
    agentId: string;
    setupId: string | null;
    flowId: string | null;
    phoneNumberId: string | null;
    activated: false;
    error?: string;
  }> = [];

  for (const setup of setups) {
    const cfg = (setup.configJson || {}) as Record<string, unknown>;
      const outcomeSlug =
      typeof cfg.outcomeSlug === "string"
        ? cfg.outcomeSlug
        : "appointment-booking";
    const agentId =
      (setup.linkedAgentIds || [])[0] ||
      (typeof cfg.agentId === "string" ? cfg.agentId : null);
    if (!agentId) {
      results.push({
        agentId: "",
        setupId: setup.id,
        flowId: null,
        phoneNumberId: null,
        activated: false,
        error: "No linked VoiceAgent",
      });
      continue;
    }

    try {
      const agent = await prisma.voiceAgent.findFirst({
        where: { id: agentId, workspaceId },
        select: {
          id: true,
          name: true,
          phoneNumberId: true,
          primaryFlowId: true,
          telnyxAssistantId: true,
          linkedAutomationIds: true,
        },
      });
      if (!agent) {
        results.push({
          agentId,
          setupId: setup.id,
          flowId: null,
          phoneNumberId: null,
          activated: false,
          error: "VoiceAgent missing",
        });
        continue;
      }

      await prisma.voiceAgent.update({
        where: { id: agent.id },
        data: {
          agentType: agentTypeFromOutcomeSlug(outcomeSlug),
          purpose: "appointment_receptionist",
          updatedAt: new Date(),
        },
      });

      const phoneNumberId =
        agent.phoneNumberId ||
        (setup.linkedPhoneNumberIds || [])[0] ||
        null;

      const compiled = await ensureAgentPrimaryWorkflow({
        workspaceId,
        agentName: agent.name,
        outcomeSlug,
        existingFlowId:
          setup.primaryFlowId ||
          agent.primaryFlowId ||
          agent.linkedAutomationIds?.[0] ||
          null,
        agentId: agent.id,
        setupId: setup.id,
        phoneNumberId,
        telnyxAssistantId: agent.telnyxAssistantId,
        triggerBlock: triggerBlockFromAnswerWhen(
          typeof cfg.answerWhen === "string" ? cfg.answerWhen : "every_call",
        ),
        routingMode: routingModeFromAnswerWhen(
          typeof cfg.answerWhen === "string" ? cfg.answerWhen : "every_call",
        ),
        activate: false,
        description: phoneNumberId
          ? `Generated from ${agent.name}`
          : `Generated from ${agent.name} — Phone number required`,
      });

      results.push({
        agentId: agent.id,
        setupId: setup.id,
        flowId: compiled.flowId,
        phoneNumberId,
        activated: false,
      });
    } catch (err) {
      results.push({
        agentId,
        setupId: setup.id,
        flowId: null,
        phoneNumberId: null,
        activated: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    touched: results.filter((r) => r.flowId).length,
    results,
  };
}
