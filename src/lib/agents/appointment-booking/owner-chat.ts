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
  /** Visible evidence for trust UI */
  evidence?: Array<{
    label: string;
    kind: string;
    href?: string;
    refId?: string;
  }>;
  /** Status while long work runs */
  workingStatus?: string;
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
    "What exactly are you responsible for?",
    "What are you not allowed to do?",
    "What does success look like for you?",
    "How are you doing?",
    "Explain your setup",
    "How many appointments did you book this week?",
    "Show recent failures",
    "Change the minimum notice to four hours",
    "Create an after-hours emergency workflow draft",
    "Test yourself",
  ];

  // Confirm pending proposal from conversation ("yes", "put it live", "activate this")
  if (
    input.userId &&
    /^(yes|yep|yeah|confirm|approve|go ahead|do it|activate|put (it|this) live|publish)\b/.test(
      q,
    )
  ) {
    const { listChangeProposals, confirmChangeProposal } = await import(
      "@/lib/agents/appointment-booking/change-proposals"
    );
    const { getPrisma } = await import("@/lib/db");
    const row = await getPrisma().voiceAgent.findFirst({
      where: { id: input.agentId, workspaceId: input.workspaceId },
      select: { draftConfig: true },
    });
    const pending = listChangeProposals(row?.draftConfig).find(
      (p) => p.status === "pending",
    );
    if (pending) {
      const result = await confirmChangeProposal({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        proposalId: pending.id,
        confirm: true,
        publish: true,
      });
      return {
        answer: result.live
          ? `Done. “${pending.summary}” is live on the phone line now (published to Telnyx). Callers will get the new behavior on the next call.`
          : `Applied “${pending.summary}” to draft. Publishing did not complete — check Health and try Put change live again.`,
        sources: ["confirm_change_proposal", "publishVoiceAgent"],
        suggestedFollowUps: [
          "What is your health status?",
          "Explain your setup",
          "Test yourself",
        ],
        evidence: [
          {
            label: "Open Health",
            kind: "health",
            href: `/agents/${agent.identity.id}?tab=health`,
          },
          {
            label: "Versions",
            kind: "versions",
            href: `/agents/${agent.identity.id}?tab=versions`,
          },
        ],
        data: result,
      };
    }
  }

  const { buildAgentResponsibility } = await import(
    "@/lib/agents/appointment-booking/responsibility"
  );
  const responsibility = buildAgentResponsibility(agent);

  if (
    includesAny(q, [
      "what exactly are you responsible",
      "what are you responsible",
      "your responsibility",
      "your job",
      "what do you do",
      "who are you",
      "explain your setup",
    ]) &&
    !includesAny(q, ["not allowed", "cannot", "can't", "prohibited"])
  ) {
    return {
      answer: [
        responsibility.mainObjective,
        `I serve: ${responsibility.serves.locations.join(", ") || "assigned locations"}; numbers: ${responsibility.serves.phoneNumbers.join(", ") || "none yet"}; calendar: ${responsibility.serves.calendars.join(", ") || "none"}; services: ${responsibility.serves.services.join(", ") || "none"}.`,
        `Allowed actions include: ${responsibility.allowedActions.slice(0, 5).join("; ")}.`,
        `Autonomy budget: ${responsibility.autonomyBudget}.`,
      ].join(" "),
      sources: ["responsibility", "identity", "bookingPolicy"],
      suggestedFollowUps: followUps,
      data: responsibility,
    };
  }

  if (
    includesAny(q, [
      "not allowed",
      "cannot do",
      "can't do",
      "prohibited",
      "must not",
    ])
  ) {
    return {
      answer: `I am not allowed to: ${responsibility.prohibitedActions.join("; ")}.`,
      sources: ["responsibility.prohibitedActions"],
      suggestedFollowUps: followUps,
      data: responsibility.prohibitedActions,
    };
  }

  if (includesAny(q, ["success look like", "what counts as success", "success criteria"])) {
    return {
      answer: `Success means: ${responsibility.successCriteria.join("; ")}.`,
      sources: ["responsibility.successCriteria"],
      suggestedFollowUps: followUps,
      data: responsibility.successCriteria,
    };
  }

  if (
    includesAny(q, [
      "how are you doing",
      "how are you",
      "performance",
      "compare this week",
      "versus last",
      "vs last",
    ])
  ) {
    const { buildAgentMetrics } = await import(
      "@/lib/agents/appointment-booking/metrics"
    );
    const m = await buildAgentMetrics({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      windowDays: 7,
      includePreviousWindow: true,
    });
    const prev = m.previousWindow;
    const delta =
      prev != null
        ? ` Prior ${m.windowDays} days: ${prev.appointmentsBooked} booked (${prev.bookingConversionRate}% conversion) on ${prev.callsAnswered} calls.`
        : "";
    const recs: string[] = [];
    if (m.abandonedBookingConversations > 0) {
      recs.push(
        `${m.abandonedBookingConversations} booking conversations started but did not book.`,
      );
    }
    if (m.mostRequestedServices[0]) {
      recs.push(
        `Top service: ${m.mostRequestedServices[0].service} (${m.mostRequestedServices[0].count}).`,
      );
    }
    return {
      answer: [
        `This week: ${m.callsAnswered} calls, ${m.appointmentsBooked} booked (${m.bookingConversionRate}% conversion), ${m.transfers} transfers, ${m.bookingFailures} failures.`,
        m.averageTimeToBookingSeconds != null
          ? `Average time to booking: ${m.averageTimeToBookingSeconds}s.`
          : "",
        delta,
        recs.join(" "),
      ]
        .filter(Boolean)
        .join(" "),
      sources: ["metrics"],
      suggestedFollowUps: followUps,
      data: m,
    };
  }

  if (includesAny(q, ["recommend", "improve", "opportunity", "what should i fix"])) {
    const { buildAgentDailyReport } = await import(
      "@/lib/agents/appointment-booking/reports"
    );
    const report = await buildAgentDailyReport({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    });
    return {
      answer:
        report.recommendations.length > 0
          ? report.recommendations.join(" ")
          : "No improvement recommendations from the latest window — keep monitoring conversion and calendar health.",
      sources: ["reports", "metrics", "health"],
      suggestedFollowUps: followUps,
      data: report,
    };
  }

  if (includesAny(q, ["test yourself", "run a test", "run tests", "simulate"])) {
    const { runSimulationSuite } = await import(
      "@/lib/agents/appointment-booking/simulation"
    );
    const sim = runSimulationSuite();
    return {
      answer: `Simulation suite: ${sim.summary.passed}/${sim.summary.total} passed, ${sim.summary.failed} failed, ${sim.summary.pending} pending.${
        sim.criticalFailures.length
          ? ` Critical failures: ${sim.criticalFailures.join(", ")}.`
          : " Critical scenarios passed."
      }`,
      sources: ["simulation"],
      suggestedFollowUps: followUps,
      data: sim,
    };
  }

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
        `I drafted this change (not live yet):`,
        proposal.summary,
        diffLines,
        `Reply “yes, put it live” or confirm in Versions to publish to the phone line.`,
        `Proposal id: ${proposal.id}.`,
      ].join("\n"),
      sources: ["create_change_proposal"],
      suggestedFollowUps: [
        "Yes, put it live",
        "Explain your setup",
        "How many appointments did you book this week?",
      ],
      requiresConfirmation: true,
      proposalId: proposal.id,
      evidence: [
        {
          label: "Confirm & put live",
          kind: "versions",
          href: `/agents/${agent.identity.id}?tab=versions`,
        },
      ],
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

  if (
    includesAny(q, [
      "always transfer",
      "never quote",
      "teach",
      "stop offering",
      "require a service address",
      "sewer backup",
      "do not offer same-day",
      "don't offer same-day",
    ])
  ) {
    const { classifyTeachInstruction } = await import(
      "@/lib/agents/appointment-booking/attention"
    );
    const classified = classifyTeachInstruction(input.question);
    if (classified.proposalKind === "reject") {
      return {
        answer: classified.summary,
        sources: ["teach_agent", "safety"],
        suggestedFollowUps: followUps,
        data: classified,
      };
    }
    if (classified.proposalKind === "booking_policy" && input.userId) {
      const { createChangeProposal, parseBookingPolicyRequest } = await import(
        "@/lib/agents/appointment-booking/change-proposals"
      );
      const patch = parseBookingPolicyRequest(input.question);
      if (patch) {
        const proposal = await createChangeProposal({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          userId: input.userId,
          summary: `Teach: ${input.question}`,
          patch,
        });
        return {
          answer: `Classified as ${classified.classification}. I created a change proposal — review the exact diff, run tests, then confirm before it goes live.`,
          sources: ["teach_agent", "change_proposal"],
          suggestedFollowUps: followUps,
          requiresConfirmation: true,
          proposalId: proposal.id,
          evidence: [
            {
              label: "Review proposal",
              kind: "versions",
              href: `/agents/${agent.identity.id}?tab=versions`,
            },
          ],
          workingStatus: "Created draft proposal — not deployed",
          data: { classified, proposal },
        };
      }
    }
    return {
      answer: `${classified.summary} Open Memory or Attention to approve learning items, or confirm a formal proposal in Versions.`,
      sources: ["teach_agent"],
      suggestedFollowUps: [
        "Change the minimum notice to four hours",
        "Create an after-hours emergency workflow draft",
      ],
      evidence: [
        {
          label: "Memory",
          kind: "memory",
          href: `/agents/${agent.identity.id}?tab=memory`,
        },
      ],
      data: classified,
    };
  }

  if (includesAny(q, ["duplicate", "make another", "copy this agent", "another amy", "for richmond"])) {
    const suggested = `${agent.identity.name} — Richmond`;
    return {
      answer: [
        `I can duplicate myself into a new draft named like “${suggested}”.`,
        "The copy will not reuse this production number or calendar — those must be selected.",
        "Confirm with the duplicate_agent command (confirm:true) from the UI.",
        "The original agent stays unchanged.",
      ].join(" "),
      sources: ["duplicate_agent"],
      suggestedFollowUps: [
        "Explain your setup",
        "Create an after-hours emergency workflow draft",
      ],
      requiresConfirmation: true,
      evidence: [
        {
          label: "Open Versions",
          kind: "versions",
          href: `/agents/${agent.identity.id}?tab=versions`,
        },
      ],
      data: {
        command: "duplicate_agent",
        suggestedName: suggested,
        mustReplace: ["phone number", "calendar", "location", "timezone"],
        safeToInherit: ["voice", "personality", "general knowledge", "booking structure"],
      },
    };
  }

  if (includesAny(q, ["what do you do", "who are you", "explain your setup", "your job"])) {
    // Handled above via responsibility — keep fallback for older phrasing
    return {
      answer: [
        `I'm ${agent.identity.displayName}.`,
        responsibility.mainObjective,
        `Status: ${agent.identity.status}. Health: ${agent.health.overall}.`,
        `Number: ${agent.resources.numberLabel}. Calendar: ${agent.resources.calendarLabel}.`,
      ].join(" "),
      sources: ["identity", "responsibility"],
      suggestedFollowUps: followUps,
      data: responsibility,
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

  if (includesAny(q, ["health", "ready", "dependency", "warning", "degraded"])) {
    const checks = [
      agent.health.telnyxAssistant,
      agent.health.assignedNumber,
      agent.health.calendar,
      agent.health.primaryWorkflow,
      agent.health.latestDeployment,
      agent.health.smsConfirmation,
      agent.health.slotHolds,
    ]
      .filter((c) => c && c.status !== "healthy")
      .map((c) => `${c.status}: ${c.message}`);
    const blockers = agent.readiness?.blockers || [];
    return {
      answer:
        checks.length === 0
          ? `Overall health is ${agent.health.overall}. Readiness: ${agent.readiness?.label || "unknown"}. All required dependencies look healthy.`
          : `Overall health is ${agent.health.overall}. Readiness: ${agent.readiness?.label || "unknown"}. Issues: ${checks.join(" | ")}${blockers.length ? `. Blockers: ${blockers.map((b) => b.message).join("; ")}` : ""}`,
      sources: ["health", "readiness"],
      suggestedFollowUps: followUps,
      evidence: [
        {
          label: "Open Health",
          kind: "health",
          href: `/agents/${agent.identity.id}?tab=health`,
        },
        ...(agent.health.calendar.status === "failed"
          ? [
              {
                label: "Reconnect calendar",
                kind: "calendar",
                href: "/integrations",
              },
            ]
          : []),
      ],
      data: { health: agent.health, readiness: agent.readiness },
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
      evidence: [
        {
          label: "Open call",
          kind: "call",
          href: `/voice/calls/${recent.callId}`,
          refId: recent.callId,
        },
        {
          label: "View timeline",
          kind: "timeline",
          href: `/agents/${agent.identity.id}?tab=activity&callId=${recent.callId}`,
          refId: recent.callId,
        },
        {
          label: "View calendar health",
          kind: "health",
          href: `/agents/${agent.identity.id}?tab=health`,
        },
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
