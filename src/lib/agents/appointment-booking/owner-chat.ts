/**
 * Owner conversation — retrieval + structured proposals.
 * Never mutates production without a separate confirm command.
 */

import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import {
  explainTraceFailure,
  searchAgentActivity,
  diagnoseCallFailure,
} from "@/lib/agents/appointment-booking/execution-trace";
import {
  createChangeProposal,
  parseBookingPolicyRequest,
} from "@/lib/agents/appointment-booking/change-proposals";
import { createWorkflowDraft } from "@/lib/agents/appointment-booking/workflow-architect";
import {
  preflightOwnerRequest,
  enrichOwnerReply,
  hasOwnerAmyLlmConfigured,
  formatOwnerAmyRuntimeIndicator,
} from "@/lib/agents/appointment-booking/intelligence/owner-runtime";
import { runOwnerAmyLlmLoop } from "@/lib/agents/appointment-booking/intelligence/owner-llm-loop";

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
  /** Runtime mode for admin diagnostics */
  runtimeMode?: "llm_agent" | "limited_fallback";
  runtimeIndicator?: string;
};

function includesAny(q: string, words: string[]) {
  return words.some((w) => q.includes(w));
}

async function registerProposalConfirmation(input: {
  workspaceId: string;
  agentId: string;
  userId?: string;
  proposalId: string;
}) {
  if (!input.userId) return;
  const { createActionConfirmation } = await import(
    "@/lib/agents/appointment-booking/intelligence/owner-confirmation"
  );
  await createActionConfirmation({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    userId: input.userId,
    actionType: "confirm_change_proposal",
    targetId: input.proposalId,
  });
}

export async function answerOwnerQuestion(input: {
  workspaceId: string;
  agentId: string;
  userId?: string;
  question: string;
  agent: AppointmentBookingAgentView;
}): Promise<OwnerChatReply> {
  const preflight = preflightOwnerRequest(input.question, input.agent);
  if (preflight.blocked) {
    return enrichOwnerReply(
      {
        answer: preflight.blocked,
        sources: ["capability_boundary"],
        suggestedFollowUps: [
          "What exactly are you responsible for?",
          "Explain your setup",
          "Test yourself",
        ],
      },
      preflight.state,
    );
  }

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

  // Confirm pending proposal via backend confirmation record (not regex self-confirm in LLM).
  if (input.userId) {
    const { isExplicitOwnerApproval, listActionConfirmations, consumeActionConfirmation } =
      await import("@/lib/agents/appointment-booking/intelligence/owner-confirmation");
    const { getPrisma } = await import("@/lib/db");

    if (isExplicitOwnerApproval(q)) {
      const row = await getPrisma().voiceAgent.findFirst({
        where: { id: input.agentId, workspaceId: input.workspaceId },
        select: { draftConfig: true },
      });
      const pendingConfirmation = listActionConfirmations(row?.draftConfig).find(
        (c) => c.userId === input.userId && !c.confirmedAt && new Date(c.expiresAt) > new Date(),
      );
      if (pendingConfirmation) {
        try {
          await consumeActionConfirmation({
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            userId: input.userId,
            confirmationId: pendingConfirmation.id,
            actionType: pendingConfirmation.actionType,
            targetId: pendingConfirmation.targetId,
          });
          if (pendingConfirmation.actionType === "confirm_change_proposal") {
            const { confirmChangeProposal } = await import(
              "@/lib/agents/appointment-booking/change-proposals"
            );
            const result = await confirmChangeProposal({
              workspaceId: input.workspaceId,
              agentId: input.agentId,
              userId: input.userId,
              proposalId: pendingConfirmation.targetId,
              confirm: true,
              publish: true,
            });
            return {
              answer: result.live
                ? "Done. The change is live on the phone line now (published to Telnyx)."
                : "Applied to draft. Publishing did not complete — check Health and try again in chat.",
              sources: ["confirm_change_proposal", "action_confirmation"],
              suggestedFollowUps: ["What is your health status?", "Test yourself"],
              runtimeMode: hasOwnerAmyLlmConfigured() ? "llm_agent" : "limited_fallback",
              runtimeIndicator: formatOwnerAmyRuntimeIndicator(),
              data: result,
            };
          }
          if (pendingConfirmation.actionType === "promote_workflow_draft") {
            const { promoteWorkflowDraft } = await import(
              "@/lib/agents/appointment-booking/workflow-promote"
            );
            const result = await promoteWorkflowDraft({
              workspaceId: input.workspaceId,
              agentId: input.agentId,
              userId: input.userId,
              draftId: pendingConfirmation.targetId,
              confirm: true,
              activateTriggers: true,
            });
            return {
              answer: [
                `Workflow draft "${result.draft.name}" is promoted.`,
                result.triggersActivated
                  ? "Automation triggers are active."
                  : "Review Health if triggers did not activate.",
                result.href ? `Open workflow: ${result.href}` : "",
              ]
                .filter(Boolean)
                .join(" "),
              sources: ["promote_workflow_draft", "action_confirmation"],
              suggestedFollowUps: ["What is your health status?", "Test yourself"],
              runtimeMode: hasOwnerAmyLlmConfigured() ? "llm_agent" : "limited_fallback",
              runtimeIndicator: formatOwnerAmyRuntimeIndicator(),
              workflowDraftId: result.draft.id,
              data: result,
            };
          }
        } catch (err) {
          return {
            answer: err instanceof Error ? err.message : "Confirmation failed",
            sources: ["action_confirmation"],
            suggestedFollowUps: followUps,
            runtimeMode: hasOwnerAmyLlmConfigured() ? "llm_agent" : "limited_fallback",
            runtimeIndicator: formatOwnerAmyRuntimeIndicator(),
          };
        }
      }
    }
  }

  const runtimeMode = hasOwnerAmyLlmConfigured() ? "llm_agent" : "limited_fallback";
  const runtimeIndicator = formatOwnerAmyRuntimeIndicator();

  // Primary path: LLM agent with tool calling (Owner Amy).
  if (hasOwnerAmyLlmConfigured()) {
    try {
      const { getPrisma } = await import("@/lib/db");
      const row = await getPrisma().voiceAgent.findFirst({
        where: { id: input.agentId, workspaceId: input.workspaceId },
        select: { draftConfig: true },
      });
      const reply = await runOwnerAmyLlmLoop({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        question: input.question,
        agent: input.agent,
        draftConfig: row?.draftConfig,
      });
      return { ...reply, runtimeMode: "llm_agent", runtimeIndicator };
    } catch (err) {
      console.warn(
        "[owner-amy] LLM loop failed, using deterministic fallback",
        err instanceof Error ? err.message : err,
      );
    }
  }

  const { buildAgentResponsibility } = await import(
    "@/lib/agents/appointment-booking/responsibility"
  );
  const responsibility = buildAgentResponsibility(agent);

  // Pre-live / incomplete setup — Amy interviews the owner
  if (
    includesAny(q, [
      "help me set up",
      "finish setup",
      "what do you need",
      "what's missing",
      "whats missing",
      "train yourself",
      "continue setup",
      "get ready",
    ]) ||
    (agent.identity.status !== "active" &&
      includesAny(q, ["start", "let's begin", "lets begin", "hello amy", "hi amy"]))
  ) {
    const { computeSetupReadiness, setupInterviewOpening } = await import(
      "@/lib/agents/appointment-booking/setup-commands"
    );
    const readiness = computeSetupReadiness(agent);
    return {
      answer: [
        setupInterviewOpening(agent),
        `Progress: ${readiness.completeCount} of ${readiness.totalCount} sections.`,
        readiness.missingAmySpecific.length
          ? `Still needed: ${readiness.missingAmySpecific.join(" · ")}`
          : "Amy-specific setup looks complete — we can generate workflow, test, and activate.",
      ].join("\n\n"),
      sources: ["get_setup_readiness", "company_brain"],
      suggestedFollowUps: [
        readiness.nextQuestion || "Explain your setup",
        "Change the minimum notice to four hours",
        "Add a required email for appointments",
        "Test yourself",
      ].filter(Boolean),
      evidence: [
        {
          label: "Guided setup",
          kind: "setup",
          href: `/solutions/appointment-receptionist?agentId=${agent.voiceAgentId}&hire=amy`,
        },
        {
          label: "Company Brain",
          kind: "knowledge",
          href: "/company-brain",
        },
      ],
      data: readiness,
    };
  }

  // Custom collection fields from conversation
  if (
    input.userId &&
    includesAny(q, ["add", "require", "collect", "ask for", "ask callers", "must collect"]) &&
    includesAny(q, [
      "field",
      "question",
      "email",
      "address",
      "vehicle",
      "year",
      "make",
      "model",
      "information",
      "describe",
      "problem",
      "notes",
      "caller to",
    ])
  ) {
    const { createCustomCollectionField } = await import(
      "@/lib/agents/appointment-booking/collection-fields"
    );
    const { createChangeProposal } = await import(
      "@/lib/agents/appointment-booking/change-proposals"
    );
    let label = "Custom field";
    let type: "text" | "email" | "address" | "number" = "text";
    if (/\bemail\b/.test(q)) {
      label = "Email address";
      type = "email";
    } else if (/\baddress\b/.test(q)) {
      label = "Service address";
      type = "address";
    } else if (/vehicle|year.*make|make.*model/.test(q)) {
      label = "Vehicle year, make, and model";
      type = "text";
    } else if (/describe|problem|issue|notes/.test(q)) {
      label = "Problem description";
      type = "text";
    } else {
      const m = input.question.match(
        /(?:add|require|collect|ask for)\s+(?:a\s+|an\s+|the\s+)?(.+?)(?:\s+for\s+|\s*$)/i,
      );
      if (m?.[1]) label = m[1].replace(/[?.!]+$/, "").trim().slice(0, 80);
    }
    const required = !/\boptional\b/.test(q);
    const field = createCustomCollectionField({
      label,
      type,
      required,
      question:
        type === "email"
          ? "What's your email address?"
          : type === "address"
            ? "What address should the technician come to?"
            : `Could you tell me your ${label.toLowerCase()}?`,
      saveTo: ["contact", "appointment"],
    });
    const serviceMatch = input.question.match(
      /for\s+([a-z0-9][a-z0-9\s_-]{1,40}?)\s+appointments?/i,
    );
    if (serviceMatch) {
      field.appliesToServiceIds = [
        serviceMatch[1].trim().toLowerCase().replace(/\s+/g, "_"),
      ];
    }
    const proposal = await createChangeProposal({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      userId: input.userId,
      summary: `Add required information: ${label}`,
      collectionField: {
        id: field.id,
        key: field.key,
        label: field.label,
        question: field.question,
        type: field.type,
        required: field.required,
        enabled: true,
        confirmationRequired: field.confirmationRequired,
        appliesToServiceIds: field.appliesToServiceIds,
        saveTo: field.saveTo,
      },
    });
    await registerProposalConfirmation({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      userId: input.userId,
      proposalId: proposal.id,
    });
    return {
      answer: [
        `Proposed change:`,
        `• Add required information: ${label}`,
        field.appliesToServiceIds?.length
          ? `• For: ${field.appliesToServiceIds.join(", ")} appointments`
          : `• For: all bookable appointments`,
        `• Save to: ${(field.saveTo || []).join(" and ")}`,
        `• Required tests: ${proposal.testsRequired.length}`,
        ``,
        `Say “yes, put it live” when you’re ready — I’ll ask in chat before anything goes live.`,
      ].join("\n"),
      sources: ["collection_fields", "change_proposal"],
      suggestedFollowUps: ["Yes, put it live", "Test yourself", "Explain your setup"],
      requiresConfirmation: true,
      proposalId: proposal.id,
      evidence: [
        {
          label: "Review draft",
          kind: "versions",
          href: `/agents/${agent.identity.id}?section=build`,
        },
      ],
      data: { proposal, field },
    };
  }

  // Greeting / voice updates
  if (
    input.userId &&
    includesAny(q, ["greeting", "say hello", "opening line", "introduce yourself as"])
  ) {
    const { createChangeProposal } = await import(
      "@/lib/agents/appointment-booking/change-proposals"
    );
    const quoted =
      input.question.match(/["“](.+?)["”]/)?.[1] ||
      input.question.match(/greeting(?:\s+to)?\s*[:\-]\s*(.+)$/i)?.[1];
    if (quoted?.trim()) {
      const proposal = await createChangeProposal({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        summary: "Update opening greeting",
        voice: { openingGreeting: quoted.trim() },
      });
      await registerProposalConfirmation({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        proposalId: proposal.id,
      });
      return {
        answer: `I'll update my greeting to: “${quoted.trim()}”. Want me to put this live on the phone line?`,
        sources: ["voice", "change_proposal"],
        suggestedFollowUps: ["Yes, put it live", "Test yourself"],
        requiresConfirmation: true,
        proposalId: proposal.id,
        evidence: [
          {
            label: "Review proposal",
            kind: "versions",
            href: `/agents/${agent.identity.id}?section=build`,
          },
        ],
        data: proposal,
      };
    }
  }

  // Live version vs Telnyx
  if (
    includesAny(q, [
      "what version",
      "which version",
      "callers currently",
      "currently using",
      "deployed version",
      "live version",
      "drift",
    ])
  ) {
    const { detectDeploymentDrift } = await import(
      "@/lib/agents/appointment-booking/deployment-drift"
    );
    const drift = await detectDeploymentDrift({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    });
    const current = agent.versions.find((v) => v.id === agent.currentVersionId);
    return {
      answer: [
        current
          ? `Database current version: v${current.version}${current.changeLog ? ` — ${current.changeLog}` : ""}.`
          : "No published AgentVersion marked current in the database.",
        drift.message,
        drift.drifted
          ? `Differences: ${drift.differences.join(", ") || "see Health"}. You can redeploy the expected version, import the external change, or pause me.`
          : "Live Telnyx configuration matches the expected version hash.",
      ].join(" "),
      sources: ["versions", "deployment_drift", "telnyx"],
      suggestedFollowUps: ["What is your health status?", "Test yourself"],
      evidence: [
        {
          label: "Health / drift",
          kind: "health",
          href: `/agents/${agent.identity.id}?section=settings`,
        },
      ],
      data: drift,
    };
  }

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
    await registerProposalConfirmation({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      userId: input.userId,
      proposalId: proposal.id,
    });
    const diffLines = proposal.changes
      .map((c) => `• ${c.path}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`)
      .join("\n");
    return {
      answer: [
        `I drafted this change (not live yet):`,
        proposal.summary,
        diffLines,
        `Reply “yes, put it live” in chat when you’re ready.`,
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
          label: "Review proposal",
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
    const draftReady =
      draft.validationStatus === "valid" &&
      Boolean(draft.id) &&
      (!draft.architectResult || draft.architectResult.status === "draft_created");
    let confirmationId: string | undefined;
    if (draftReady && input.userId && draft.id) {
      const { createActionConfirmation } = await import(
        "@/lib/agents/appointment-booking/intelligence/owner-confirmation"
      );
      const confirmation = await createActionConfirmation({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        userId: input.userId,
        actionType: "promote_workflow_draft",
        targetId: draft.id,
      });
      confirmationId = confirmation.id;
    }
    return {
      answer: draftReady
        ? [
            `Created workflow draft "${draft.name}".`,
            `Validation: ${draft.validationStatus}.`,
            draft.validationErrors.length
              ? `Errors: ${draft.validationErrors.map((e) => e.message).join("; ")}`
              : "No validation errors.",
            `Draft id: ${draft.id}.`,
            "This draft is not live. Review it in Workflows, run tests, then say “yes, put it live” in chat.",
          ].join(" ")
        : [
            `Could not create a valid workflow draft for this request.`,
            draft.architectResult?.summary || draft.validationErrors.map((e) => e.message).join("; "),
            "Try a more specific request or configure the Workflow Architect LLM.",
          ].join(" "),
      sources: ["create_workflow_draft"],
      suggestedFollowUps: followUps,
      requiresConfirmation: draftReady,
      workflowDraftId: draft.id,
      data: { draft, confirmationId },
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
        await registerProposalConfirmation({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          userId: input.userId,
          proposalId: proposal.id,
        });
        return {
          answer: `Classified as ${classified.classification}. I created a change proposal — want me to put it live after you review the diff?`,
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
    const diagnosis = diagnoseCallFailure(recent);
    return enrichOwnerReply(
      {
      answer: `${recent.summary}. ${diagnosis.ownerExplanation} ${diagnosis.recommendedNextAction}`,
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
      data: { trace: recent, diagnosis },
    },
    preflight.state,
    );
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

  return enrichOwnerReply(
    {
      answer: [
        runtimeMode === "limited_fallback"
          ? "Owner Amy is running in limited fallback mode — deterministic routing without full LLM tool selection."
          : "",
        `I can answer from my live configuration, health, metrics, and call traces.`,
        `I can also draft booking-policy changes and workflow graphs — but I will not activate them without confirmation.`,
        `I did not match a specific tool query for: "${input.question}".`,
      ]
        .filter(Boolean)
        .join(" "),
      sources: ["identity", `intent:${preflight.state.route.intent}`, "limited_fallback"],
      suggestedFollowUps: followUps,
      runtimeMode,
      runtimeIndicator,
    },
    preflight.state,
  );
}
