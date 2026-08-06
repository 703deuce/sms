/**
 * Employee-style operational timeline — generated from structured events, not CoT.
 */

import type {
  AgentExecutionStep,
  AgentExecutionTrace,
} from "@/lib/agents/appointment-booking/types";

export type EmployeeTimelineItem = {
  at: string;
  timeLabel: string;
  headline: string;
  detail?: string;
  links: Array<{
    kind:
      | "call"
      | "tool"
      | "state"
      | "calendar"
      | "sms"
      | "transcript"
      | "health";
    label: string;
    href?: string;
    refId?: string;
  }>;
  status: "ok" | "warning" | "failed" | "info";
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function blockHeadline(step: AgentExecutionStep): {
  headline: string;
  status: EmployeeTimelineItem["status"];
} {
  const t = String(step.blockType || "").toLowerCase();
  const failed = step.status === "failed";
  const status: EmployeeTimelineItem["status"] = failed
    ? "failed"
    : step.status === "skipped"
      ? "info"
      : "ok";

  if (t === "inbound_call" || t.includes("answer")) {
    return { headline: "Answered the call", status };
  }
  if (t.includes("resolve_datetime") || t.includes("datetime")) {
    return {
      headline: failed
        ? "Could not interpret the requested time"
        : "Interpreted the requested time",
      status,
    };
  }
  if (t.includes("calendar_availability") || t.includes("availability")) {
    return {
      headline: failed ? "Availability check failed" : "Checked availability",
      status: failed ? "failed" : "ok",
    };
  }
  if (t.includes("hold_appointment") || t.includes("slot_hold") || t.includes("hold")) {
    return {
      headline: failed ? "Could not hold the slot" : "Held the appointment slot",
      status,
    };
  }
  if (t.includes("release") && t.includes("hold")) {
    return { headline: "Released the slot hold", status: "info" };
  }
  if (t.includes("book_appointment") || t.includes("create_appointment")) {
    return {
      headline: failed
        ? "Appointment could not be confirmed"
        : "Booked the appointment",
      status,
    };
  }
  if (t.includes("verify") || t.includes("post_book")) {
    return {
      headline: failed
        ? "Booking verification failed"
        : "Verified the calendar event",
      status,
    };
  }
  if (t.includes("send_sms") || t.includes("sms")) {
    return {
      headline: failed
        ? "Confirmation text failed"
        : "Sent the confirmation text",
      status,
    };
  }
  if (t.includes("transfer")) {
    return {
      headline: failed ? "Transfer failed" : "Transferred the call",
      status,
    };
  }
  if (t.includes("intent") || t.includes("understand")) {
    return { headline: "Understood the caller’s request", status };
  }
  if (t.includes("confirm")) {
    return { headline: "Confirmed details with the caller", status };
  }
  if (t.includes("end") || t.includes("complete") || t.includes("hangup")) {
    return { headline: "Call completed", status };
  }

  const label = step.blockType.replace(/_/g, " ");
  return {
    headline: failed ? `${label} failed` : label.charAt(0).toUpperCase() + label.slice(1),
    status,
  };
}

function detailFromStep(step: AgentExecutionStep): string | undefined {
  if (step.errorMessage) return step.errorMessage;
  const out = step.sanitizedOutput;
  if (!out || typeof out !== "object") return undefined;
  const o = out as Record<string, unknown>;
  const bits: string[] = [];
  for (const key of [
    "normalized",
    "startsAt",
    "service",
    "name",
    "from",
    "slots",
    "appointmentId",
    "externalId",
    "summary",
  ]) {
    if (o[key] != null && typeof o[key] !== "object") {
      bits.push(`${key}: ${String(o[key])}`);
    }
  }
  return bits.length ? bits.slice(0, 3).join(" · ") : undefined;
}

/**
 * Build a readable employee timeline from an execution trace.
 */
export function buildEmployeeTimeline(
  trace: AgentExecutionTrace,
  opts?: { agentId?: string },
): EmployeeTimelineItem[] {
  const items: EmployeeTimelineItem[] = [];
  const agentId = opts?.agentId || trace.agentId;

  items.push({
    at: trace.startedAt,
    timeLabel: formatTime(trace.startedAt),
    headline: trace.callerPhone
      ? `Answered ${trace.callerPhone}`
      : "Answered inbound call",
    detail: trace.summary || undefined,
    links: [
      {
        kind: "call",
        label: "Open call",
        href: `/voice/calls/${trace.callId}`,
        refId: trace.callId,
      },
      {
        kind: "transcript",
        label: "Transcript",
        href: `/voice/calls/${trace.callId}`,
        refId: trace.callId,
      },
    ],
    status: "ok",
  });

  for (const step of trace.steps) {
    if (step.blockType === "inbound_call") continue;
    const { headline, status } = blockHeadline(step);
    const links: EmployeeTimelineItem["links"] = [
      {
        kind: "tool",
        label: "View step",
        refId: step.nodeId || String(step.sequence),
      },
    ];
    if (
      /book|appointment|calendar/i.test(step.blockType) &&
      step.status === "succeeded"
    ) {
      links.push({
        kind: "calendar",
        label: "Calendar record",
        refId: trace.callId,
      });
    }
    if (/sms/i.test(step.blockType)) {
      links.push({ kind: "sms", label: "SMS record", refId: trace.callId });
    }
    items.push({
      at: step.startedAt,
      timeLabel: formatTime(step.startedAt),
      headline,
      detail: detailFromStep(step),
      links,
      status,
    });
  }

  if (trace.completedAt) {
    const outcomeLabel =
      trace.outcome === "appointment_booked"
        ? "Call completed — appointment verified path"
        : trace.outcome === "appointment_requested"
          ? "Call completed — booking request left for staff"
          : trace.outcome === "failed"
            ? "Call ended with a failure"
            : trace.outcome === "abandoned"
              ? "Caller left before finishing"
              : "Call completed";
    items.push({
      at: trace.completedAt,
      timeLabel: formatTime(trace.completedAt),
      headline: outcomeLabel,
      detail: trace.failureCode || undefined,
      links: [
        {
          kind: "call",
          label: "Full activity",
          href: `/agents/${agentId}?tab=activity&callId=${trace.callId}`,
          refId: trace.callId,
        },
      ],
      status:
        trace.outcome === "failed"
          ? "failed"
          : trace.outcome === "abandoned"
            ? "warning"
            : "ok",
    });
  }

  return items;
}

/** Compact reasoning path for “Why this happened” (structured, not CoT). */
export function buildOperationalReasoningPath(
  trace: AgentExecutionTrace,
): string[] {
  return buildEmployeeTimeline(trace).map((item) => item.headline);
}
