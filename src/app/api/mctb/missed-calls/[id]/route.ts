import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { buildMctbEventTimeline } from "@/lib/mctb/timeline";
import { countCallerMissedEventsToday } from "@/lib/mctb/repeat-caller";
import { loadConsentForMissedCallEvent } from "@/lib/mctb/consent-log";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const { id } = await params;
  traceMctbDebug("missed-call-detail", "get_start", { workspaceId, eventId: id });

  try {
    const timeline = await buildMctbEventTimeline(id);
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    const event = await prisma.missedCallEvent.findFirst({
      where: { id, workspaceId },
    });
    if (!event) {
      traceMctbDebug("missed-call-detail", "not_found", { workspaceId, eventId: id });
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [repeatCaller, linkClicks, formSubmissions, config, consent, contact, conversation, voicemail] =
      await Promise.all([
      countCallerMissedEventsToday(workspaceId, event.callerE164),
      prisma.linkClickEvent.findMany({
        where: { workspaceId, missedCallEventId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, destinationUrl: true, createdAt: true },
      }),
      prisma.mctbRequestFormSubmission
        .findMany({
          where: { workspaceId, missedCallEventId: id },
          orderBy: { submittedAt: "desc" },
          take: 10,
          select: { id: true, submittedAt: true, payloadJson: true },
        })
        .catch(() => []),
      loadMissedCallTextConfig(workspaceId),
      loadConsentForMissedCallEvent({ workspaceId, missedCallEventId: id }),
      event.contactId
        ? prisma.contact.findFirst({
            where: { id: event.contactId, workspaceId },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve(null),
      event.contactId
        ? prisma.conversation.findFirst({
            where: {
              workspaceId,
              contactId: event.contactId,
              productSource: appProductSourceToPrisma("mctb"),
            },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              unread: true,
              status: true,
              updatedAt: true,
              messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, createdAt: true, direction: true } },
            },
          })
        : Promise.resolve(null),
      prisma.voicemailMessage.findFirst({
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
      }),
    ]);

    traceMctbDebug("missed-call-detail", "get_complete", {
      workspaceId,
      eventId: id,
      status: event.status,
      callerE164: event.callerE164,
      timelineSteps: timeline.steps.length,
    });

    return NextResponse.json({
      ok: true,
      event,
      timeline,
      repeatCaller,
      linkClicks: linkClicks.map((c: { id: string; destinationUrl: string | null; createdAt: Date }) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      formSubmissions: formSubmissions.map((s: { id: string; submittedAt: Date; payloadJson: unknown }) => ({
        ...s,
        submittedAt: s.submittedAt.toISOString(),
      })),
      leadCaptureEnabled: config.leadCaptureEnabled,
      consent,
      contact,
      conversation: conversation
        ? {
            id: conversation.id,
            unread: conversation.unread,
            status: conversation.status,
            updatedAt: conversation.updatedAt.toISOString(),
            lastMessage: conversation.messages[0]
              ? {
                  body: conversation.messages[0].body,
                  createdAt: conversation.messages[0].createdAt.toISOString(),
                  direction: conversation.messages[0].direction,
                }
              : null,
          }
        : null,
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
    });
  } catch (err) {
    traceMctbDebugError("missed-call-detail", "get_failed", err, { workspaceId, eventId: id });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
