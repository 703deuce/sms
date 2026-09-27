import "server-only";

import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { loadConsentForMissedCallEvent } from "@/lib/mctb/consent-log";
import { countCallerMissedEventsToday } from "@/lib/mctb/repeat-caller";
import { buildMctbEventTimeline } from "@/lib/mctb/timeline";
import { getPrisma } from "@/lib/db";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";

function serializeEvent(event: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...event };
  for (const key of ["detectedAt", "scheduledSmsAt", "smsSentAt", "createdAt", "updatedAt"] as const) {
    const v = out[key];
    if (v instanceof Date) out[key] = v.toISOString();
  }
  return out;
}

async function loadConversationForEvent(
  workspaceId: string,
  event: { id: string; contactId: string | null; callerE164: string },
) {
  const prisma = getPrisma();
  const productSource = appProductSourceToPrisma("mctb");
  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        workspaceId,
        productSource,
        OR: [
          { missedCallEventId: event.id },
          ...(event.contactId ? [{ contactId: event.contactId }] : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        unread: true,
        status: true,
        updatedAt: true,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { body: true, createdAt: true, direction: true },
        },
      },
    });
    if (!conversation) return null;
    return {
      id: conversation.id,
      unread: conversation.unread,
      status: conversation.status,
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages
        .slice()
        .reverse()
        .map((m) => ({
          body: m.body,
          createdAt: m.createdAt.toISOString(),
          direction: m.direction,
        })),
    };
  } catch {
    return null;
  }
}

export async function loadMctbMissedCallDetailPayload(workspaceId: string, eventId: string) {
  const prisma = getPrisma();
  const event = await prisma.missedCallEvent.findFirst({
    where: { id: eventId, workspaceId },
  });
  if (!event) {
    return { ok: false as const, status: 404, error: "Not found" };
  }

  let timeline;
  try {
    timeline = await buildMctbEventTimeline(eventId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "timeline_failed";
    if (message === "event_not_found") {
      return { ok: false as const, status: 404, error: "Not found" };
    }
    timeline = {
      eventId: event.id,
      traceId: event.traceId,
      consentMode: "press_1",
      steps: [],
    };
  }

  const [
    repeatCaller,
    linkClicks,
    formSubmissions,
    config,
    consent,
    contact,
    conversation,
    voicemail,
  ] = await Promise.all([
    countCallerMissedEventsToday(workspaceId, event.callerE164).catch(() => ({
      total: 0,
      missedToday: 0,
    })),
    prisma.linkClickEvent
      .findMany({
        where: { workspaceId, missedCallEventId: eventId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, destinationUrl: true, createdAt: true },
      })
      .catch(() => []),
    prisma.mctbRequestFormSubmission
      .findMany({
        where: { workspaceId, missedCallEventId: eventId },
        orderBy: { submittedAt: "desc" },
        take: 10,
        select: { id: true, submittedAt: true, payloadJson: true },
      })
      .catch(() => []),
    loadMissedCallTextConfig(workspaceId).catch(() => null),
    loadConsentForMissedCallEvent({ workspaceId, missedCallEventId: eventId }).catch(() => null),
    event.contactId
      ? prisma.contact
          .findFirst({
            where: { id: event.contactId, workspaceId },
            select: { id: true, firstName: true, lastName: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
    loadConversationForEvent(workspaceId, {
      id: event.id,
      contactId: event.contactId,
      callerE164: event.callerE164,
    }),
    prisma.voicemailMessage
      .findFirst({
        where: {
          workspaceId,
          fromE164: event.callerE164,
          createdAt: {
            gte: new Date(event.detectedAt.getTime() - 10 * 60 * 1000),
            lte: new Date(event.detectedAt.getTime() + 60 * 60 * 1000),
          },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          createdAt: true,
          transcriptText: true,
          transcriptStatus: true,
          aiSummary: true,
          durationSeconds: true,
        },
      })
      .catch(() => null),
  ]);

  return {
    ok: true as const,
    status: 200,
    body: {
      ok: true,
      event: serializeEvent(event as unknown as Record<string, unknown>),
      timeline,
      repeatCaller,
      linkClicks: linkClicks.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      formSubmissions: formSubmissions.map((s) => ({
        ...s,
        submittedAt: s.submittedAt.toISOString(),
      })),
      leadCaptureEnabled: config?.leadCaptureEnabled ?? false,
      consent,
      contact,
      conversation,
      voicemail: voicemail
        ? {
            id: voicemail.id,
            createdAt: voicemail.createdAt.toISOString(),
            transcriptText: voicemail.transcriptText,
            transcriptStatus: voicemail.transcriptStatus,
            aiSummary: voicemail.aiSummary,
            durationSeconds: voicemail.durationSeconds,
          }
        : null,
    },
  };
}
