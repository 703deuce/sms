/**
 * Typed Agent Control API — owner actions never write tables ad hoc.
 */

import { getPrisma } from "@/lib/db";
import { loadAppointmentBookingAgent } from "@/lib/agents/appointment-booking/load-agent";
import {
  buildExecutionTrace,
  explainTraceFailure,
  searchAgentActivity,
} from "@/lib/agents/appointment-booking/execution-trace";
import { answerOwnerQuestion } from "@/lib/agents/appointment-booking/owner-chat";
import {
  confirmChangeProposal,
  createChangeProposal,
  listChangeProposals,
  rejectChangeProposal,
} from "@/lib/agents/appointment-booking/change-proposals";
import {
  createWorkflowDraft,
  listWorkflowDrafts,
  validateStoredWorkflowDraft,
} from "@/lib/agents/appointment-booking/workflow-architect";
import {
  activateAgentVersion,
  duplicateAppointmentAgent,
  rollbackAgentVersion,
  snapshotAgentForTest,
} from "@/lib/agents/appointment-booking/lifecycle";
import type { AgentControlCommand } from "@/lib/agents/appointment-booking/types";
import type { BookingPolicy } from "@/lib/agents/appointment-booking/types";

export async function runAgentControlCommand(input: {
  workspaceId: string;
  userId: string;
  agentId: string;
  command: AgentControlCommand;
  payload?: Record<string, unknown>;
}) {
  const agent = await loadAppointmentBookingAgent(
    input.workspaceId,
    input.agentId,
  );
  if (!agent) {
    throw new Error("Appointment Booking Agent not found");
  }

  const prisma = getPrisma();

  switch (input.command) {
    case "get_agent_summary":
      return {
        identity: agent.identity,
        resources: agent.resources,
        health: agent.health.overall,
        metrics: agent.metrics,
        telnyxAssistantId: agent.telnyxAssistantId,
        primaryFlowId: agent.primaryFlowId,
      };

    case "get_agent_configuration":
      return {
        identity: agent.identity,
        profile: agent.profile,
        bookingPolicy: agent.bookingPolicy,
        businessBrain: {
          businessName: agent.businessBrain.businessName,
          website: agent.businessBrain.website,
          defaultTimezone: agent.businessBrain.defaultTimezone,
          locations: agent.businessBrain.locations,
          services: agent.businessBrain.services,
          transferDestinations: agent.businessBrain.transferDestinations,
          knowledgeFacts: agent.businessBrain.knowledgeFacts.slice(0, 20),
          prohibitedClaims: agent.businessBrain.prohibitedClaims,
        },
        resources: agent.resources,
      };

    case "get_agent_health":
      return agent.health;

    case "get_agent_metrics":
      return agent.metrics;

    case "search_agent_activity": {
      const traces = await searchAgentActivity({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        limit: Number(input.payload?.limit || 20),
        failuresOnly: Boolean(input.payload?.failuresOnly),
      });
      return { traces };
    }

    case "get_call_details":
    case "get_execution_trace": {
      const callId = String(input.payload?.callId || "").trim();
      if (!callId) throw new Error("callId required");
      const trace = await buildExecutionTrace({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId,
      });
      if (!trace) throw new Error("Call not found for this agent");
      return { trace };
    }

    case "explain_call_failure": {
      const callId = String(input.payload?.callId || "").trim();
      if (!callId) throw new Error("callId required");
      const trace = await buildExecutionTrace({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId,
      });
      if (!trace) throw new Error("Call not found for this agent");
      return {
        trace,
        explanation: explainTraceFailure(trace),
      };
    }

    case "list_versions":
      return { versions: agent.versions, currentVersionId: agent.currentVersionId };

    case "pause_agent": {
      await prisma.voiceAgent.update({
        where: { id: input.agentId },
        data: { status: "PAUSED" },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          event: "agent.pause",
          detail: `agent=${input.agentId} by=${input.userId}`,
        },
      });
      return { ok: true, status: "paused" };
    }

    case "resume_agent": {
      await prisma.voiceAgent.update({
        where: { id: input.agentId },
        data: { status: "ACTIVE" },
      });
      await prisma.auditLog.create({
        data: {
          workspaceId: input.workspaceId,
          event: "agent.resume",
          detail: `agent=${input.agentId} by=${input.userId}`,
        },
      });
      return { ok: true, status: "active" };
    }

    case "owner_ask": {
      const question = String(input.payload?.question || "").trim();
      if (!question) throw new Error("question required");
      return answerOwnerQuestion({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        question,
        agent,
      });
    }

    case "create_change_proposal":
      return createChangeProposal({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        patch: (input.payload?.patch || undefined) as Partial<BookingPolicy> | undefined,
        summary: input.payload?.summary
          ? String(input.payload.summary)
          : undefined,
        naturalLanguage: input.payload?.naturalLanguage
          ? String(input.payload.naturalLanguage)
          : undefined,
      });

    case "list_change_proposals": {
      const row = await prisma.voiceAgent.findFirst({
        where: { id: input.agentId, workspaceId: input.workspaceId },
      });
      return { proposals: listChangeProposals(row?.draftConfig) };
    }

    case "confirm_change_proposal":
      return confirmChangeProposal({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        proposalId: String(input.payload?.proposalId || ""),
        confirm: Boolean(input.payload?.confirm),
        publish: Boolean(input.payload?.publish),
      });

    case "reject_change_proposal":
      return rejectChangeProposal({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        proposalId: String(input.payload?.proposalId || ""),
      });

    case "create_workflow_draft":
      return createWorkflowDraft({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        userRequest: String(input.payload?.userRequest || input.payload?.question || ""),
        phoneNumberId: agent.phoneNumberIds[0] || null,
        timezone: agent.profile.timezone,
      });

    case "validate_workflow_draft":
      return validateStoredWorkflowDraft({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        draftId: String(input.payload?.draftId || ""),
      });

    case "list_workflow_drafts": {
      const row = await prisma.voiceAgent.findFirst({
        where: { id: input.agentId, workspaceId: input.workspaceId },
      });
      return { drafts: listWorkflowDrafts(row?.draftConfig) };
    }

    case "run_agent_test_snapshot":
      return snapshotAgentForTest({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
      });

    case "activate_agent_version":
      return activateAgentVersion({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        confirm: Boolean(input.payload?.confirm),
        changeLog: input.payload?.changeLog
          ? String(input.payload.changeLog)
          : undefined,
      });

    case "rollback_agent_version":
      return rollbackAgentVersion({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        versionId: String(input.payload?.versionId || ""),
        confirm: Boolean(input.payload?.confirm),
      });

    case "duplicate_agent":
      return duplicateAppointmentAgent({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        name: input.payload?.name ? String(input.payload.name) : undefined,
        confirm: Boolean(input.payload?.confirm),
      });

    default:
      throw new Error(`Unsupported command: ${input.command}`);
  }
}
