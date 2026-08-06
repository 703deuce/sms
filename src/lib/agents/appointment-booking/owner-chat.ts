/**
 * Owner conversation — retrieval + structured proposals.
 * Never mutates production without a separate confirm command.
 */

import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import {
  explainTraceFailure,
  searchAgentActivity,
} from "@/lib/agents/appointment-booking/execution-trace";
import {
  createChangeProposal,
  parseBookingPolicyRequest,
} from "@/lib/agents/appointment-booking/change-proposals";
import { createWorkflowDraft } from "@/lib/agents/appointment-booking/workflow-architect";

export type OwnerChatReply = {
  answer: string;
  sources: string[];
  suggestedFollowUps: string[];
  data?: unknown;
  requiresConfirmation?: boolean;
  proposalId?: string;
  workflowDraftId?: string;
};

function includesAny(q: string, words: string[]) {
  return words.some((w) => q.includes(w));
}

export async function answerOwnerQuestion(input: {
  workspaceId: string;
  agentId: string;
  userId?: string;
  question: string;
  agent: AppointmentBookingAgentView;
}): Promise<OwnerChatReply> {
  const q = input.question.toLowerCase().trim();
  const agent = input.agent;
  const followUps = [
    "Explain your setup",
    "How many appointments did you book this week?",
    "Show recent failures",
    "Change the minimum notice to four hours",
    "Create an after-hours emergency workflow draft",
  ];

  // Change proposal (draft only)
  const policyPatch = parseBookingPolicyRequest(input.question);
  if (
    policyPatch &&
    includesAny(q, [
      "change",
      "set",
      "stop",
      "require",
      "disable",
      "enable",
      "allow",
      "turn",
      "minimum notice",
      "same-day",
      "same day",
    ])
  ) {
    if (!input.userId) {
      return {
        answer:
          "I can propose that booking-policy change, but a signed-in owner is required to store the proposal.",
        sources: ["change_proposals"],
        suggestedFollowUps: followUps,
      };
    }
    const proposal = await createChangeProposal({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      userId: input.userId,
      patch: policyPatch,
      naturalLanguage: input.question,
    });
    const diffLines = proposal.changes
      .map((c) => `• ${c.path}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`)
      .join("\n");
    return {
      answer: [
        `I created a ${proposal.riskLevel}-risk draft proposal (not applied yet).`,
        proposal.summary,
        diffLines,
        `Proposal id: ${proposal.id}.`,
        "Confirm in the Versions tab or call confirm_change_proposal with confirm:true (optionally publish:true).",
      ].join("\n"),
      sources: ["create_change_proposal"],
      suggestedFollowUps: [
        "Explain your setup",
        "How many appointments did you book this week?",
      ],
      requiresConfirmation: true,
      proposalId: proposal.id,
      data: proposal,
    };
  }

  // Workflow architect draft
  if (
    includesAny(q, [
      "create an after-hours",
      "after-hours version",
      "after hours workflow",
      "workflow draft",
      "create another receptionist",
      "emergency only",
      "duplicate this for",
    ]) &&
    !includesAny(q, ["duplicate agent", "make another randy"])
  ) {
    if (!input.userId) {
      return {
        answer: "Sign in is required to create a workflow draft.",
        sources: ["workflow_architect"],
        suggestedFollowUps: followUps,
      };
    }
    const draft = await createWorkflowDraft({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      userId: input.userId,
      userRequest: input.question,
      phoneNumberId: agent.phoneNumberIds[0] || null,
      timezone: agent.profile.timezone,
    });
    return {
      answer: [
        `Created workflow draft “${draft.name}”.`,
        `Validation: ${draft.validationStatus}.`,
        draft.validationErrors.length
          ? `Errors: ${draft.validationErrors.map((e) => e.message).join("; ")}`
          : "No validation errors.",
        `Draft id: ${draft.id}.`,
        "This draft is not live. Review it in Workflows, then activate only after tests and confirmation.",
      ].join(" "),
      sources: ["create_workflow_draft"],
      suggestedFollowUps: followUps,
      requiresConfirmation: true,
      workflowDraftId: draft.id,
      data: draft,
    };
  }

  if (includesAny(q, ["duplicate", "make another", "copy this agent", "another randy"])) {
    return {
      answer: [
        "I can duplicate this agent into a new DRAFT (no phone attached).",
        "That requires an explicit confirm_change via the duplicate_agent control command with confirm:true.",
        "Suggested name example: “Randy — Richmond After Hours”.",
        "I will not create the copy until you confirm in the UI or API.",
      ].join(" "),
      sources: ["duplicate_agent"],
      suggestedFollowUps: ["Explain your setup", "Create an after-hours emergency workflow draft"],
      requiresConfirmation: true,
      data: {
        command: "duplicate_agent",
        suggestedName: "Randy — copy",
      },
    };
  }

  if (includesAny(q, ["what do you do", "who are you", "explain your setup", "your job"])) {
    return {
      answer: [
        `I'm ${agent.identity.displayName}.`,
        agent.identity.description,
        `Status: ${agent.identity.status}. Health: ${agent.health.overall}.`,
        `Number: ${agent.resources.numberLabel}.`,
        `Calendar: ${agent.resources.calendarLabel}.`,
        `Location: ${agent.resources.locationLabel}.`,
        `Booking: ${agent.bookingPolicy.canBook ? "enabled" : "disabled"}; reschedule ${agent.bookingPolicy.canReschedule ? "on" : "off"}; cancel ${agent.bookingPolicy.canCancel ? "on" : "off"}.`,
        `Minimum notice: ${agent.bookingPolicy.minimumNoticeMinutes} minutes. Duration: ${agent.bookingPolicy.appointmentDurationMinutes} minutes.`,
        agent.bookingPolicy.sameDayCutoff
          ? `Same-day cutoff: ${agent.bookingPolicy.sameDayCutoff}.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      sources: ["identity", "bookingPolicy", "resources", "health"],
      suggestedFollowUps: followUps,
      data: {
        identity: agent.identity,
        resources: agent.resources,
        bookingPolicy: agent.bookingPolicy,
      },
    };
  }

  if (includesAny(q, ["which number", "what number", "assigned number", "phone"])) {
    return {
      answer: agent.phoneNumberE164
        ? `I am assigned to ${agent.phoneNumberE164}. Health: ${agent.health.assignedNumber.message}.`
        : `No phone number is assigned yet. ${agent.health.assignedNumber.message}`,
      sources: ["assignedNumber", "health.assignedNumber"],
      suggestedFollowUps: followUps,
      data: {
        phoneNumberE164: agent.phoneNumberE164,
        health: agent.health.assignedNumber,
      },
    };
  }

  if (includesAny(q, ["calendar", "availability"])) {
    return {
      answer: `Calendar: ${agent.resources.calendarLabel}. ${agent.health.calendar.message}`,
      sources: ["resources.calendarLabel", "health.calendar"],
      suggestedFollowUps: followUps,
      data: {
        calendarConnectionIds: agent.calendarConnectionIds,
        health: agent.health.calendar,
      },
    };
  }

  if (includesAny(q, ["service", "what can you book", "bookable"])) {
    const services =
      agent.bookingPolicy.allowedServices.length > 0
        ? agent.bookingPolicy.allowedServices.join(", ")
        : agent.businessBrain.services.map((s) => s.name).join(", ") ||
          "No services configured yet";
    return {
      answer: `I can book: ${services}. Booking mode: ${agent.bookingPolicy.bookingMode}. Final confirmation required: ${agent.bookingPolicy.requireFinalConfirmation ? "yes" : "no"}.`,
      sources: ["bookingPolicy.allowedServices", "businessBrain.services"],
      suggestedFollowUps: followUps,
      data: {
        allowedServices: agent.bookingPolicy.allowedServices,
        services: agent.businessBrain.services,
      },
    };
  }

  if (includesAny(q, ["after hours", "after-hours", "business hours", "hours"])) {
    return {
      answer: agent.businessBrain.businessHoursSummary
        ? `Business hours on file: ${agent.businessBrain.businessHoursSummary}. Fallback: ${agent.profile.fallbackPolicySummary || "take a message"}.`
        : `I do not have approved business hours text in the shared brain yet. Fallback behavior: ${agent.profile.fallbackPolicySummary || "take a message"}.`,
      sources: ["businessBrain.businessHoursSummary", "profile.fallbackPolicySummary"],
      suggestedFollowUps: followUps,
    };
  }

  if (
    includesAny(q, [
      "how many",
      "appointments",
      "booked this week",
      "metrics",
      "conversion",
      "performance",
    ])
  ) {
    const m = agent.metrics;
    return {
      answer: `In the last ${m.windowDays} days: ${m.callsAnswered} calls answered, ${m.appointmentsBooked} appointments booked (${m.bookingConversionRate}% conversion), ${m.transfers} transfers, ${m.bookingFailures} booking/tool failures.`,
      sources: ["metrics"],
      suggestedFollowUps: followUps,
      data: m,
    };
  }

  if (includesAny(q, ["health", "ready", "dependency", "warning"])) {
    const checks = [
      agent.health.telnyxAssistant,
      agent.health.assignedNumber,
      agent.health.calendar,
      agent.health.primaryWorkflow,
      agent.health.latestDeployment,
      agent.health.smsConfirmation,
    ]
      .filter((c) => c.status !== "healthy")
      .map((c) => `${c.status}: ${c.message}`);
    return {
      answer:
        checks.length === 0
          ? `Overall health is ${agent.health.overall}. All required dependencies look healthy.`
          : `Overall health is ${agent.health.overall}. Issues: ${checks.join(" | ")}`,
      sources: ["health"],
      suggestedFollowUps: followUps,
      data: agent.health,
    };
  }

  if (
    includesAny(q, [
      "fail",
      "why didn't",
      "didn't book",
      "error",
      "last booking",
      "recent failure",
    ])
  ) {
    const traces = await searchAgentActivity({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      limit: 5,
      failuresOnly: true,
    });
    const recent =
      traces[0] ||
      (
        await searchAgentActivity({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          limit: 1,
        })
      )[0];
    if (!recent) {
      return {
        answer:
          "I do not have call activity for this agent yet, so I cannot explain a booking failure from logs.",
        sources: ["activity"],
        suggestedFollowUps: followUps,
      };
    }
    return {
      answer: `${recent.summary}. ${explainTraceFailure(recent)}`,
      sources: ["execution_trace", recent.callId],
      suggestedFollowUps: [
        "Show recent failures",
        "How many appointments did you book this week?",
      ],
      data: recent,
    };
  }

  if (includesAny(q, ["workflow", "version"])) {
    const current = agent.versions.find((v) => v.id === agent.currentVersionId);
    return {
      answer: `Primary workflow: ${agent.resources.workflowLabel}. Current version: ${current ? `v${current.version}` : agent.currentVersionId || "none published"}. ${agent.versions.length} version(s) on record.`,
      sources: ["resources.workflowLabel", "versions"],
      suggestedFollowUps: followUps,
      data: { versions: agent.versions, primaryFlowId: agent.primaryFlowId },
    };
  }

  return {
    answer: [
      `I can answer from my live configuration, health, metrics, and call traces.`,
      `I can also draft booking-policy changes and workflow graphs — but I will not activate them without confirmation.`,
      `I did not match a specific tool query for: “${input.question}”.`,
    ].join(" "),
    sources: ["identity"],
    suggestedFollowUps: followUps,
  };
}
