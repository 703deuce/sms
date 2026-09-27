import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { buildMctbEventTimeline } from "@/lib/mctb/timeline";
import { countCallerMissedEventsToday } from "@/lib/mctb/repeat-caller";
import { loadConsentForMissedCallEvent } from "@/lib/mctb/consent-log";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { traceMctbDebug, traceMctbDebugError } from "@/lib/mctb/debug";
import { appProductSourceToPrisma } from "@/lib/mass-texting/product-source";
import { buildMissedCallLifecycleMilestones } from "@/lib/mctb/missed-calls-lifecycle";
import {
  resolveMissedCallBookingActionEligibility,
  senderModeCustomerLabel,
} from "@/lib/mctb/missed-calls-booking-action";
import {
  presentRecoverySuppression,
  shouldShowWhyNotTexted,
} from "@/lib/mctb/recovery-suppression-presentation";

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

    const conversationIdForAutomation = event.contactId
      ? (
          await prisma.conversation.findFirst({
            where: {
              workspaceId,
              contactId: event.contactId,
              productSource: appProductSourceToPrisma("mctb"),
            },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          })
        )?.id
      : null;

    const [repeatCaller, linkClicks, formSubmissions, config, consent, contact, conversation, voicemail, automation, leadSnapshot, bookingAction] =
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
      conversationIdForAutomation
        ? prisma.mctbConversationAutomationState.findUnique({
            where: { conversationId: conversationIdForAutomation },
            select: {
              state: true,
              followUpStatus: true,
              capturedFieldsJson: true,
            },
          })
        : Promise.resolve(null),
      prisma.mctbLeadSnapshot.findFirst({
        where: { workspaceId, missedCallEventId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          summaryText: true,
          customerFactsJson: true,
          aiDerivedJson: true,
          createdAt: true,
        },
      }),
      resolveMissedCallBookingActionEligibility(workspaceId),
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

    const whyNotTexted = shouldShowWhyNotTexted(event.status, event.smsSentAt)
      ? presentRecoverySuppression(event.suppressionReason, event.status)
      : null;

    const lifecycle = buildMissedCallLifecycleMilestones({
      detectedAt: event.detectedAt.toISOString(),
      smsSentAt: event.smsSentAt?.toISOString() ?? null,
      status: event.status,
      suppressionReason: event.suppressionReason,
      consentCapturedAt: consent?.consentedAt
        ? new Date(String(consent.consentedAt)).toISOString()
        : null,
      consentMode: timeline.consentMode,
      timelineSteps: timeline.steps,
      automationState: automation?.state ?? null,
    });

    const capturedFields = {
      ...(automation?.capturedFieldsJson as Record<string, unknown> | undefined),
      ...((leadSnapshot?.customerFactsJson as Record<string, unknown>) || {}),
    };

    return NextResponse.json({
      ok: true,
      event,
      timeline,
      lifecycle,
      whyNotTexted,
      messagingContext: {
        senderLabel: senderModeCustomerLabel(config.senderMode),
        senderMode: config.senderMode,
      },
      bookingAction,
      capturedFields,
      leadSummary: leadSnapshot?.summaryText ?? null,
      automation: automation
        ? {
            state: automation.state,
            followUpStatus: automation.followUpStatus,
          }
        : null,
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
      timezone: config.timezone,
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
