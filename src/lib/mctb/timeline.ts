import "server-only";

import { getPrisma } from "@/lib/db";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";

export type MctbTimelineStep = {
  id: string;
  label: string;
  status: "pending" | "complete" | "failed" | "skipped";
  at: string | null;
  detail?: Record<string, unknown>;
};

type MissedCallTextTraceRow = {
  kind: string;
  createdAt: Date;
  detail: unknown;
};

const TRACE_LABELS: Record<string, string> = {
  "call.missed": "Call received",
  "mctb.eligibility.passed": "Eligible for recovery",
  "mctb.eligibility.failed": "Suppressed",
  "mctb.scheduled": "SMS queued",
  "sms.send.started": "SMS send started",
  "sms.send.accepted": "SMS sent",
  "sms.delivered": "SMS delivered",
  "sms.send.failed": "SMS failed",
  "sms.send.blocked": "SMS blocked",
  "mctb.consent.recorded": "Consent recorded",
};

function stepStatusFromEvent(kind: string, detail?: Record<string, unknown>): MctbTimelineStep["status"] {
  if (kind.includes("failed") || kind.includes("blocked")) return "failed";
  if (kind === "mctb.eligibility.failed") return "skipped";
  if (detail?.suppressed) return "skipped";
  return "complete";
}

export async function buildMctbEventTimeline(missedCallEventId: string): Promise<{
  eventId: string;
  traceId: string;
  consentMode: string;
  steps: MctbTimelineStep[];
}> {
  const prisma = getPrisma();
  const event = await prisma.missedCallEvent.findUnique({
    where: { id: missedCallEventId },
  });
  if (!event) {
    throw new Error("event_not_found");
  }

  const [traces, consentMode] = await Promise.all([
    prisma.missedCallTextTrace.findMany({
      where: { missedCallEventId },
      orderBy: { createdAt: "asc" },
    }),
    loadMctbConsentMode(event.workspaceId),
  ]);

  const steps: MctbTimelineStep[] = [];
  const push = (id: string, label: string, status: MctbTimelineStep["status"], at: string | null, detail?: Record<string, unknown>) => {
    steps.push({ id, label, status, at, detail });
  };

  push("call_received", "Call received", "complete", event.detectedAt.toISOString(), {
    callerE164: event.callerE164,
    businessE164: event.businessE164,
  });

  if (consentMode === "existing_consent") {
    push(
      "existing_consent_verified",
      "Existing consent config verified",
      event.eligible ? "complete" : "skipped",
      event.updatedAt.toISOString(),
      { suppressionReason: event.suppressionReason },
    );
  } else {
    const consentTrace = traces.find((t: MissedCallTextTraceRow) => t.kind.includes("consent"));
    push(
      "call_answered",
      "Call answered by MCTB",
      "complete",
      event.detectedAt.toISOString(),
    );
    push(
      "consent_prompt",
      "Consent prompt played",
      consentTrace ? "complete" : event.status === "SUPPRESSED" ? "skipped" : "pending",
      consentTrace?.createdAt.toISOString() || null,
    );
    push(
      "press_1",
      "Press 1 received",
      event.status === "SENT" || event.status === "SCHEDULED" || event.status === "SENDING"
        ? "complete"
        : event.status === "SUPPRESSED"
          ? "skipped"
          : "pending",
      null,
    );
    push(
      "consent_recorded",
      "Consent recorded",
      event.status === "SENT" || event.status === "SCHEDULED" || event.status === "SENDING"
        ? "complete"
        : "pending",
      null,
    );
  }

  for (const trace of traces) {
    const label = TRACE_LABELS[trace.kind] || trace.kind;
    const detail =
      trace.detail && typeof trace.detail === "object"
        ? (trace.detail as Record<string, unknown>)
        : undefined;
    push(trace.kind, label, stepStatusFromEvent(trace.kind, detail), trace.createdAt.toISOString(), detail);
  }

  const deliveredTrace = traces.find((t: MissedCallTextTraceRow) => t.kind === "sms.delivered");
  let linkedMessage: { deliveredAt: Date | null; status: string } | null = null;
  if (event.smsMessageId) {
    linkedMessage = await prisma.message.findUnique({
      where: { id: event.smsMessageId },
      select: { deliveredAt: true, status: true },
    });
  }

  if (event.smsSentAt && !deliveredTrace) {
    const deliveredAt = linkedMessage?.deliveredAt;
    if (deliveredAt) {
      push("sms_delivered", "SMS delivered", "complete", deliveredAt.toISOString(), {
        smsMessageId: event.smsMessageId,
        source: "message.deliveredAt",
      });
    } else if (linkedMessage?.status === "failed" || linkedMessage?.status === "undelivered") {
      push("sms_delivered", "SMS delivered", "failed", event.updatedAt.toISOString(), {
        smsMessageId: event.smsMessageId,
        messageStatus: linkedMessage.status,
      });
    } else {
      push("sms_delivered", "SMS delivered", "pending", null, {
        note: "Waiting for carrier delivery confirmation",
        smsMessageId: event.smsMessageId,
      });
    }
  }

  if (event.status === "FAILED") {
    push("failed", "Failed", "failed", event.updatedAt.toISOString(), {
      suppressionReason: event.suppressionReason,
    });
  }

  return {
    eventId: event.id,
    traceId: event.traceId,
    consentMode,
    steps,
  };
}
