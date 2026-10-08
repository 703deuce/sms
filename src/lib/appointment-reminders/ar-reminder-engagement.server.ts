import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { buildDedicatedReminderTimeline } from "@/lib/appointments/reminder-engine";
import {
  isArSmsOutcomeTimelineEvent,
  resolveArCustomerResponseSummary,
  type ArReminderEngagementStep,
} from "./ar-sms-customer-outcome";

function outcomeLabelForType(type: string): string {
  if (type.endsWith("confirmed")) return "Confirmed attendance";
  if (type.endsWith("cancel_pending")) return "Cancel requested";
  if (type.endsWith("cancelled")) return "Cancelled";
  if (type.endsWith("reschedule_started")) return "Rescheduling";
  if (type.endsWith("reschedule_requested")) return "Reschedule requested";
  if (type.endsWith("rescheduled")) return "Rescheduled";
  return "Customer action";
}

export function buildArReminderEngagementFromMetadata(input: {
  metadata: AppointmentMetadata;
  startsAt: string;
  timezone?: string | null;
  status: string;
}): ArReminderEngagementStep[] {
  const timeline = input.metadata.timeline || [];
  const sent = buildDedicatedReminderTimeline(input.metadata).filter(
    (e) => e.type.includes("_sent") || e.type === "confirmation_sent",
  );
  const outcomes = timeline.filter((e) => isArSmsOutcomeTimelineEvent(e.type));

  return sent.map((step) => {
    const linked = outcomes.filter((o) => o.detail?.startsWith(step.type));
    const latest = linked[linked.length - 1];
    const engagement: ArReminderEngagementStep = {
      reminderLabel: step.label,
      timelineType: step.type,
      sentAt: step.at,
      sendStatus: step.type.includes("failed") ? "failed" : "sent",
    };
    if (latest) {
      engagement.customerResponse = {
        kind: "replied",
        label: latest.label || outcomeLabelForType(latest.type),
        detailLine: latest.detail?.includes("|")
          ? latest.detail.split("|").slice(1).join("|").trim()
          : undefined,
        at: latest.at,
      };
    }
    return engagement;
  });
}

export async function loadArReminderEngagementPayload(input: {
  workspaceId: string;
  appointmentId: string;
  metadata: AppointmentMetadata;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  status: string;
}) {
  const customerResponse = resolveArCustomerResponseSummary({
    status: input.status,
    startsAt: input.startsAt,
    timezone: input.timezone,
    metadata: input.metadata,
  });

  const reminderEngagement = buildArReminderEngagementFromMetadata({
    metadata: input.metadata,
    startsAt: input.startsAt,
    timezone: input.timezone,
    status: input.status,
  });

  const sessions = await getPrisma().arSmsReplySession.findMany({
    where: { workspaceId: input.workspaceId, appointmentId: input.appointmentId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      timelineType: true,
      lifecycleState: true,
      createdAt: true,
      completedAt: true,
      lastUsedAt: true,
    },
  });

  for (const step of reminderEngagement) {
    if (step.customerResponse) continue;
    const session = sessions.find((s) => s.timelineType === step.timelineType);
    if (!session) continue;
    if (session.lifecycleState === "AWAITING_REPLY") {
      step.customerResponse = {
        kind: "awaiting_reply",
        label: "Awaiting customer reply",
        at: session.createdAt.toISOString(),
      };
    } else if (session.lifecycleState === "RESCHEDULING") {
      step.customerResponse = {
        kind: "reschedule_pending",
        label: "Rescheduling in progress",
        at: session.lastUsedAt.toISOString(),
      };
    } else if (session.lifecycleState === "AWAITING_CANCEL_CONFIRM") {
      step.customerResponse = {
        kind: "cancel_pending",
        label: "Awaiting cancel confirmation",
        at: session.lastUsedAt.toISOString(),
      };
    } else if (session.lifecycleState === "COMPLETED" && session.completedAt) {
      step.customerResponse = {
        kind: "replied",
        label: "Conversation completed",
        at: session.completedAt.toISOString(),
      };
    }
  }

  return {
    customerResponse,
    reminderEngagement,
    sessions: sessions.map((s) => ({
      id: s.id,
      timelineType: s.timelineType,
      lifecycleState: s.lifecycleState,
      createdAt: s.createdAt.toISOString(),
      completedAt: s.completedAt?.toISOString() ?? null,
    })),
  };
}
