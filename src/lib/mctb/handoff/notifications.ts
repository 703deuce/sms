import { getPrisma } from "@/lib/db";
import { notifyWorkspace } from "@/lib/notifications/in-app";
import { notifyWorkspaceByEmail } from "@/lib/notifications/workspace-email";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { loadMctbHandoffConfig, loadMctbNotificationRecipients } from "./config";
import { recipientAllowsNotificationChannel } from "./recipient-event-routing";
import { MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY } from "@/lib/mctb/launch-flags";
import { renderMctbTeamEmail, renderMctbTeamSms, type NotificationRenderInput } from "./templates";
import type { MctbHandoffEventType, MctbLeadSnapshotDerived, MctbLeadSnapshotFacts } from "./types";

function appBaseUrl(): string {
  return process.env.APP_URL?.replace(/\/$/, "") || "";
}

export async function deliverMctbHandoffNotifications(input: {
  workspaceId: string;
  handoffEventId: string;
  eventType: MctbHandoffEventType;
  urgent?: boolean;
  facts: MctbLeadSnapshotFacts;
  derived?: MctbLeadSnapshotDerived;
  conversationId?: string | null;
  missedCallEventId?: string | null;
}) {
  const { isRecordingHandoffMode, deliverRecordingHandoffNotifications } = await import(
    "@/lib/mctb/lead-recovery/testing/recording/recording-handoff"
  );
  if (isRecordingHandoffMode()) {
    return deliverRecordingHandoffNotifications(input);
  }
  const config = await loadMctbHandoffConfig(input.workspaceId);
  const recipients = (await loadMctbNotificationRecipients(input.workspaceId)).filter(
    (r) => r.enabled,
  );
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true },
  });
  const routing =
    config.routingMatrix[input.eventType] ||
    config.routingMatrix.caller_replied ||
    { channels: { in_app: true }, recipientIds: [] as string[] };

  // Missed-call recovery is inherently off-hours — do not delay or suppress team alerts.
  const suppressNonUrgentSms = false;
  const blockAllNonUrgent = false;

  const base = appBaseUrl();
  const renderInput: NotificationRenderInput = {
    businessName: workspace?.name || "Your business",
    eventType: input.eventType,
    urgent: input.urgent,
    facts: input.facts,
    derived: input.derived,
    conversationUrl: input.conversationId && base
      ? `${base}/mctb/conversations/${input.conversationId}`
      : undefined,
    missedCallUrl: input.missedCallEventId && base
      ? `${base}/mctb/missed-calls/${input.missedCallEventId}`
      : undefined,
    callTelUrl: input.facts.callerPhone ? `tel:${input.facts.callerPhone}` : undefined,
  };

  const targetRecipients =
    routing.recipientIds?.length
      ? recipients.filter((r) => routing.recipientIds!.includes(r.id))
      : recipients;

  const channels = routing.channels || { in_app: true };
  const results: Array<{ channel: string; status: string; destination?: string }> = [];

  const emailRecipients = targetRecipients.filter(
    (r) =>
      r.email &&
      recipientAllowsNotificationChannel({
        recipient: r,
        eventType: input.eventType,
        channel: "email",
      }),
  );
  const smsRecipients = targetRecipients.filter(
    (r) =>
      r.mobileE164 &&
      recipientAllowsNotificationChannel({
        recipient: r,
        eventType: input.eventType,
        channel: "sms",
      }),
  );

  if (blockAllNonUrgent && !channels.email) {
    return { delivered: results, suppressed: true, reason: "quiet_hours" };
  }

  const idemBase = `mctb-notify:${input.handoffEventId}`;

  if (channels.in_app && !blockAllNonUrgent && !MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY) {
    const idempotencyKey = `${idemBase}:in_app`;
    const prior = await prisma.mctbNotificationDelivery.findUnique({
      where: { idempotencyKey },
    });
    if (!prior) {
      await notifyWorkspace(input.workspaceId, {
        type: input.urgent ? "mctb_urgent" : "mctb_handoff",
        title: input.urgent ? "Urgent missed-call lead" : "Missed-call lead",
        body: renderMctbTeamSms(renderInput).slice(0, 240),
        href: renderInput.conversationUrl || "/mctb/missed-calls",
      }).catch(() => undefined);
      await prisma.mctbNotificationDelivery.create({
        data: {
          workspaceId: input.workspaceId,
          handoffEventId: input.handoffEventId,
          channel: "in_app",
          destination: "workspace",
          status: "sent",
          idempotencyKey,
          attemptCount: 1,
          sentAt: new Date(),
        },
      });
      results.push({ channel: "in_app", status: "sent" });
    }
  }

  if (channels.email && !blockAllNonUrgent) {
    for (const recipient of emailRecipients) {
      const idempotencyKey = `${idemBase}:email:${recipient.id}`;
      const prior = await prisma.mctbNotificationDelivery.findUnique({
        where: { idempotencyKey },
      });
      if (prior) continue;
      const email = renderMctbTeamEmail(renderInput);
      try {
        await notifyWorkspaceByEmail(input.workspaceId, {
          type: input.urgent ? "mctb_urgent" : "mctb_handoff",
          title: email.subject,
          subject: email.subject,
          htmlContent: email.html,
          textContent: email.text,
        });
        await prisma.mctbNotificationDelivery.create({
          data: {
            workspaceId: input.workspaceId,
            handoffEventId: input.handoffEventId,
            recipientId: recipient.id,
            channel: "email",
            destination: recipient.email!,
            status: "sent",
            idempotencyKey,
            attemptCount: 1,
            sentAt: new Date(),
          },
        });
        results.push({ channel: "email", status: "sent", destination: recipient.email ?? undefined });
      } catch (err) {
        await prisma.mctbNotificationDelivery.create({
          data: {
            workspaceId: input.workspaceId,
            handoffEventId: input.handoffEventId,
            recipientId: recipient.id,
            channel: "email",
            destination: recipient.email!,
            status: "failed",
            failureReason: err instanceof Error ? err.message : "email_failed",
            idempotencyKey,
            attemptCount: 1,
            failedAt: new Date(),
          },
        });
        results.push({ channel: "email", status: "failed", destination: recipient.email ?? undefined });
      }
    }
  }

  if (channels.sms && !suppressNonUrgentSms && !blockAllNonUrgent) {
    const smsBody = renderMctbTeamSms(renderInput);
    for (const recipient of smsRecipients) {
      const idempotencyKey = `${idemBase}:sms:${recipient.id}`;
      const prior = await prisma.mctbNotificationDelivery.findUnique({
        where: { idempotencyKey },
      });
      if (prior) continue;
      try {
        await sendQuickSms({
          workspaceId: input.workspaceId,
          to: recipient.mobileE164!,
          body: smsBody,
          idempotencyKey,
        });
        await prisma.mctbNotificationDelivery.create({
          data: {
            workspaceId: input.workspaceId,
            handoffEventId: input.handoffEventId,
            recipientId: recipient.id,
            channel: "sms",
            destination: recipient.mobileE164!,
            status: "sent",
            idempotencyKey,
            attemptCount: 1,
            sentAt: new Date(),
          },
        });
        results.push({ channel: "sms", status: "sent", destination: recipient.mobileE164 ?? undefined });
      } catch (err) {
        await prisma.mctbNotificationDelivery.create({
          data: {
            workspaceId: input.workspaceId,
            handoffEventId: input.handoffEventId,
            recipientId: recipient.id,
            channel: "sms",
            destination: recipient.mobileE164!,
            status: "failed",
            failureReason: err instanceof Error ? err.message : "sms_failed",
            idempotencyKey,
            attemptCount: 1,
            failedAt: new Date(),
          },
        });
        results.push({ channel: "sms", status: "failed", destination: recipient.mobileE164 ?? undefined });
      }
    }
  }

  return { delivered: results, suppressed: false };
}
