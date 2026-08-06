/**
 * Owner conversation — read-only answers using tools/retrieval, not guesses.
 * Separate from live caller Telnyx prompts.
 */

import type { AppointmentBookingAgentView } from "@/lib/agents/appointment-booking/types";
import {
  explainTraceFailure,
  searchAgentActivity,
} from "@/lib/agents/appointment-booking/execution-trace";

export type OwnerChatReply = {
  answer: string;
  sources: string[];
  suggestedFollowUps: string[];
  data?: unknown;
};

function includesAny(q: string, words: string[]) {
  return words.some((w) => q.includes(w));
}

export async function answerOwnerQuestion(input: {
  workspaceId: string;
  agentId: string;
  question: string;
  agent: AppointmentBookingAgentView;
}): Promise<OwnerChatReply> {
  const q = input.question.toLowerCase().trim();
  const agent = input.agent;
  const followUps = [
    "Explain your setup",
    "How many appointments did you book this week?",
    "Show recent failures",
    "What calendar do you use?",
  ];

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
      ].join(" "),
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

  if (includesAny(q, ["how many", "appointments", "booked this week", "metrics", "conversion", "performance"])) {
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

  if (includesAny(q, ["fail", "why didn't", "didn't book", "error", "last booking", "recent failure"])) {
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
      suggestedFollowUps: ["Show recent failures", "How many appointments did you book this week?"],
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

  // Default: honest limitation — do not invent.
  return {
    answer: [
      `I can answer from my live configuration, health, metrics, and call traces.`,
      `I did not match a specific tool query for: “${input.question}”.`,
      `Try asking about my number, calendar, services, hours, metrics, health, or a failed call.`,
    ].join(" "),
    sources: ["identity"],
    suggestedFollowUps: followUps,
  };
}
