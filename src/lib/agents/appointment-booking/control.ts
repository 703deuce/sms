/**
 * Typed Agent Control API — owner actions never write tables ad hoc.
 */

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
  parseBookingPolicyRequest,
  rejectChangeProposal,
} from "@/lib/agents/appointment-booking/change-proposals";
import {
  createWorkflowDraft,
  listWorkflowDrafts,
  validateStoredWorkflowDraft,
} from "@/lib/agents/appointment-booking/workflow-architect";
import { promoteWorkflowDraft } from "@/lib/agents/appointment-booking/workflow-promote";
import {
  activateAgentVersion,
  duplicateAppointmentAgent,
  pauseAppointmentAgent,
  resumeAppointmentAgent,
  rollbackAgentVersion,
  snapshotAgentForTest,
} from "@/lib/agents/appointment-booking/lifecycle";
import { runAgentTestSnapshotSuite } from "@/lib/agents/appointment-booking/test-suite";
import { runSimulationSuite } from "@/lib/agents/appointment-booking/simulation";
import {
  attachMissedCallTextBackForAgent,
  getMissedCallHandoff,
} from "@/lib/agents/appointment-booking/missed-call-handoff";
import {
  approveKnowledgeFacts,
  saveBusinessBrainPartial,
} from "@/lib/agents/appointment-booking/business-brain";
import {
  pauseAgentCapability,
  resumeAgentCapability,
  runSafeAutoRepair,
  setAutonomyBudget,
} from "@/lib/agents/appointment-booking/autonomy";
import {
  buildAgentDailyReport,
  buildAgentExceptionAlerts,
} from "@/lib/agents/appointment-booking/reports";
import { buildAgentResponsibility } from "@/lib/agents/appointment-booking/responsibility";
import { createAgentHandoff, listAgentHandoffs } from "@/lib/agents/appointment-booking/handoffs";
import { getPrisma } from "@/lib/db";
import type { AgentControlCommand } from "@/lib/agents/appointment-booking/types";
import type { BookingPolicy, BusinessBrain } from "@/lib/agents/appointment-booking/types";
import type { AgentExecutionTrace } from "@/lib/agents/appointment-booking/types";
import type { AutonomyBudget, AgentCapabilityPause } from "@/lib/agents/appointment-booking/responsibility";

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
          knowledgeFacts: agent.businessBrain.knowledgeFacts.slice(0, 40),
          prohibitedClaims: agent.businessBrain.prohibitedClaims,
          approvedPolicies: agent.businessBrain.approvedPolicies,
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

    case "pause_agent":
      return pauseAppointmentAgent({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
      });

    case "resume_agent":
      return resumeAppointmentAgent({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
      });

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

    case "promote_workflow_draft":
      return promoteWorkflowDraft({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        draftId: String(input.payload?.draftId || ""),
        confirm: Boolean(input.payload?.confirm),
        activateTriggers: Boolean(input.payload?.activateTriggers ?? true),
        attachMissedCallTextBack: Boolean(input.payload?.attachMissedCallTextBack),
      });

    case "run_agent_test_snapshot":
      return snapshotAgentForTest({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
      });

    case "run_agent_test_suite":
      return runAgentTestSnapshotSuite({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        tracesByScenario: input.payload?.tracesByScenario as
          | Record<string, AgentExecutionTrace>
          | undefined,
      });

    case "run_agent_simulation":
      return runSimulationSuite();

    case "get_agent_responsibility":
      return { responsibility: buildAgentResponsibility(agent) };

    case "get_daily_report":
      return buildAgentDailyReport({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
      });

    case "get_exception_alerts":
      return buildAgentExceptionAlerts({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
      });

    case "set_autonomy_budget":
      return setAutonomyBudget({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        budget: String(input.payload?.budget || "standard") as AutonomyBudget,
        confirm: Boolean(input.payload?.confirm),
      });

    case "pause_capability":
      return pauseAgentCapability({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        capability: String(
          input.payload?.capability || "confirmationSms",
        ) as keyof AgentCapabilityPause,
        reason: String(input.payload?.reason || "Owner requested"),
      });

    case "resume_capability":
      return resumeAgentCapability({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        capability: String(
          input.payload?.capability || "confirmationSms",
        ) as keyof AgentCapabilityPause,
      });

    case "run_safe_auto_repair":
      return runSafeAutoRepair({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
      });

    case "create_agent_handoff":
      return createAgentHandoff({
        workspaceId: input.workspaceId,
        fromAgentId: String(input.payload?.fromAgentId || input.agentId),
        toAgentId: String(input.payload?.toAgentId || input.agentId),
        source: String(input.payload?.source || "owner"),
        intent: String(input.payload?.intent || "book"),
        requestedNextAction: String(
          input.payload?.requestedNextAction || "book_appointment",
        ),
        collectedFields: (input.payload?.collectedFields || {}) as Record<
          string,
          unknown
        >,
        contactId: input.payload?.contactId
          ? String(input.payload.contactId)
          : undefined,
        callId: input.payload?.callId ? String(input.payload.callId) : undefined,
        urgency: (input.payload?.urgency as "low" | "normal" | "high") || "normal",
      });

    case "list_agent_handoffs": {
      const row = await prisma.voiceAgent.findFirst({
        where: { id: input.agentId, workspaceId: input.workspaceId },
      });
      return { handoffs: listAgentHandoffs(row?.draftConfig) };
    }

    case "activate_agent_version":
      return activateAgentVersion({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        confirm: Boolean(input.payload?.confirm),
        changeLog: input.payload?.changeLog
          ? String(input.payload.changeLog)
          : undefined,
        skipSimulationGate: Boolean(input.payload?.skipSimulationGate),
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

    case "save_business_brain":
      return saveBusinessBrainPartial(
        input.workspaceId,
        (input.payload?.brain || input.payload || {}) as Partial<BusinessBrain>,
      );

    case "approve_knowledge_facts":
      return approveKnowledgeFacts({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        labels: Array.isArray(input.payload?.labels)
          ? input.payload!.labels!.map(String)
          : undefined,
        approveAllPending: Boolean(input.payload?.approveAllPending),
      });

    case "attach_missed_call_text_back": {
      const phoneNumberId =
        String(input.payload?.phoneNumberId || "") ||
        agent.phoneNumberIds[0] ||
        "";
      if (!phoneNumberId) throw new Error("phoneNumberId required");
      return attachMissedCallTextBackForAgent({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        phoneNumberId,
        activate: Boolean(input.payload?.activate ?? true),
        userId: input.userId,
        firstMessage: input.payload?.firstMessage
          ? String(input.payload.firstMessage)
          : undefined,
        initialDelaySeconds:
          input.payload?.initialDelaySeconds != null
            ? Number(input.payload.initialDelaySeconds)
            : 20,
      });
    }

    case "get_missed_call_handoff": {
      const row = await prisma.voiceAgent.findFirst({
        where: { id: input.agentId, workspaceId: input.workspaceId },
      });
      return { handoff: getMissedCallHandoff(row?.draftConfig) };
    }

    case "get_employee_timeline": {
      const callId = String(input.payload?.callId || "");
      if (!callId) throw new Error("callId required");
      const trace = await buildExecutionTrace({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        callId,
      });
      if (!trace) throw new Error("Call trace not found");
      const {
        buildEmployeeTimeline,
        buildOperationalReasoningPath,
      } = await import("@/lib/agents/appointment-booking/employee-timeline");
      return {
        timeline: buildEmployeeTimeline(trace, { agentId: input.agentId }),
        reasoningPath: buildOperationalReasoningPath(trace),
        trace,
      };
    }

    case "get_attention_inbox": {
      const { buildAttentionInbox } = await import(
        "@/lib/agents/appointment-booking/attention"
      );
      return buildAttentionInbox({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
      });
    }

    case "get_memory_view": {
      const { buildTypedMemoryView } = await import(
        "@/lib/agents/appointment-booking/attention"
      );
      return buildTypedMemoryView({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
      });
    }

    case "get_live_readiness": {
      const { buildLiveReadiness } = await import(
        "@/lib/agents/appointment-booking/readiness"
      );
      return buildLiveReadiness({
        workspaceId: input.workspaceId,
        agentStatus: agent.identity.status,
        health: agent.health,
        telnyxAssistantId: agent.telnyxAssistantId,
        phoneNumberE164: agent.phoneNumberE164,
        calendarConnectionIds: agent.calendarConnectionIds,
        primaryFlowId: agent.primaryFlowId,
        currentVersionId: agent.currentVersionId,
        runSlotHoldProbe: Boolean(input.payload?.runSlotHoldProbe),
      });
    }

    case "get_autonomy_policy": {
      const {
        budgetToMode,
        describeAutonomyMode,
        EMERGENCY_POLICIES,
      } = await import("@/lib/agents/appointment-booking/autonomy-policy");
      const responsibility = buildAgentResponsibility(agent);
      const mode = budgetToMode(responsibility.autonomyBudget);
      return {
        ...describeAutonomyMode(mode),
        storedBudget: responsibility.autonomyBudget,
        emergencyPolicies: EMERGENCY_POLICIES,
        capabilityPauses: responsibility.capabilityPauses,
      };
    }

    case "teach_agent": {
      const instruction = String(input.payload?.instruction || "").trim();
      if (!instruction) throw new Error("instruction required");
      const { classifyTeachInstruction } = await import(
        "@/lib/agents/appointment-booking/attention"
      );
      const classified = classifyTeachInstruction(instruction);
      if (classified.proposalKind === "reject") {
        return {
          ...classified,
          answer: classified.summary,
          requiresConfirmation: false,
        };
      }
      if (classified.proposalKind === "booking_policy") {
        const parsed = parseBookingPolicyRequest(instruction);
        if (parsed) {
          const proposal = await createChangeProposal({
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            userId: input.userId,
            summary: `Teach: ${instruction}`,
            patch: parsed,
          });
          return {
            ...classified,
            answer: `Classified as booking policy. Created proposal ${proposal.id}. Confirm to validate, test, and deploy.`,
            proposalId: proposal.id,
            requiresConfirmation: true,
            data: proposal,
          };
        }
      }
      if (classified.proposalKind === "workflow") {
        const draft = await createWorkflowDraft({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          userId: input.userId,
          userRequest: instruction,
        });
        return {
          ...classified,
          answer: `Classified as workflow change. Draft “${draft.name}” created (${draft.validationStatus}). Not live until you confirm after tests.`,
          workflowDraftId: draft.id,
          requiresConfirmation: true,
          data: draft,
        };
      }
      return {
        ...classified,
        answer: `${classified.summary} I will not silently store this as permanent knowledge. Review it in Memory / Attention, or confirm a formal proposal.`,
        requiresConfirmation: true,
        data: { instruction, classification: classified.classification },
      };
    }

    case "get_booking_verification": {
      const { verifyAppointmentBooking } = await import(
        "@/lib/agents/appointment-booking/verify-booking"
      );
      return verifyAppointmentBooking({
        workspaceId: input.workspaceId,
        appointmentId: input.payload?.appointmentId
          ? String(input.payload.appointmentId)
          : null,
        callId: input.payload?.callId ? String(input.payload.callId) : null,
      });
    }

    case "propose_setup_change": {
      const summary = String(input.payload?.summary || "Setup change").trim();
      const bookingPolicy = input.payload?.bookingPolicy as
        | Partial<BookingPolicy>
        | undefined;
      const voice = input.payload?.voice as
        | {
            voiceId?: string;
            voiceLabel?: string;
            openingGreeting?: string;
            speakingSpeed?: number;
          }
        | undefined;
      const collectionField = input.payload?.collectionField as
        | Record<string, unknown>
        | undefined;
      if (!bookingPolicy && !voice && !collectionField) {
        throw new Error(
          "Setup edits require bookingPolicy, voice, or collectionField — must version",
        );
      }
      return createChangeProposal({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        summary,
        patch: bookingPolicy,
        voice,
        collectionField: collectionField
          ? (collectionField as {
              id: string;
              key: string;
              label: string;
              question?: string;
              type?: string;
              required?: boolean;
              enabled?: boolean;
              confirmationRequired?: boolean;
              appliesToServiceIds?: string[];
              saveTo?: string[];
            })
          : undefined,
      });
    }

    case "get_setup_readiness": {
      const { computeSetupReadiness, setupInterviewOpening } = await import(
        "@/lib/agents/appointment-booking/setup-commands"
      );
      const readiness = computeSetupReadiness(agent);
      return {
        ...readiness,
        interviewOpening: setupInterviewOpening(agent),
      };
    }

    case "run_setup_command": {
      const { setupCommandToProposalInput } = await import(
        "@/lib/agents/appointment-booking/setup-commands"
      );
      const command = input.payload?.command as
        | import("@/lib/agents/appointment-booking/setup-commands").SetupCommand
        | undefined;
      if (!command || typeof command !== "object" || !("type" in command)) {
        throw new Error("command required");
      }
      if (command.type === "get_setup_readiness") {
        const { computeSetupReadiness } = await import(
          "@/lib/agents/appointment-booking/setup-commands"
        );
        return computeSetupReadiness(agent);
      }
      const mapped = setupCommandToProposalInput(command);
      if (!mapped) throw new Error("Unsupported setup command");
      return createChangeProposal({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        summary: mapped.summary,
        patch: mapped.bookingPolicy,
        voice: mapped.voice,
        collectionField: mapped.collectionField
          ? {
              id: mapped.collectionField.id,
              key: mapped.collectionField.key,
              label: mapped.collectionField.label,
              question: mapped.collectionField.question,
              type: mapped.collectionField.type,
              required: mapped.collectionField.required,
              enabled: mapped.collectionField.enabled,
              confirmationRequired: mapped.collectionField.confirmationRequired,
              appliesToServiceIds: mapped.collectionField.appliesToServiceIds,
              saveTo: mapped.collectionField.saveTo,
            }
          : undefined,
      });
    }

    case "get_deployment_drift": {
      const { detectDeploymentDrift } = await import(
        "@/lib/agents/appointment-booking/deployment-drift"
      );
      return detectDeploymentDrift({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        fetchRemote: input.payload?.fetchRemote !== false,
      });
    }

    case "get_runtime_registry": {
      const { runtimeRegistrySummary } = await import(
        "@/lib/agents/appointment-booking/runtime-registry"
      );
      return { runtimes: runtimeRegistrySummary() };
    }

    case "get_field_ownership_report": {
      const { migrationReport } = await import(
        "@/lib/agents/appointment-booking/field-ownership"
      );
      return migrationReport();
    }

    default:
      throw new Error(`Unsupported command: ${input.command}`);
  }
}
