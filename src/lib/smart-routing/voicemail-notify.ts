import "server-only";

import { getPrisma } from "@/lib/db";
import { notifyWorkspaceByEmail } from "@/lib/notifications/workspace-email";
import { fmtPhoneDisplay } from "./display";

export async function notifySmartRoutingVoicemailReceived(input: {
  workspaceId: string;
  sessionId: string;
  callerE164: string;
  recordingUrl?: string | null;
  notifyEmail?: string | null;
}) {
  const prisma = getPrisma();
  const session = await prisma.smartRoutingCallSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId },
    include: { flow: { select: { name: true } } },
  });
  if (!session) return;

  const caller = fmtPhoneDisplay(input.callerE164);
  const flowName = session.flow?.name ?? "Smart Routing";
  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";
  const activityLink = appUrl
    ? `${appUrl}/smart-routing/activity?session=${input.sessionId}`
    : null;

  const html = `<p>New voicemail on <strong>${flowName}</strong>.</p>
<p>From: ${caller}</p>
${input.recordingUrl ? `<p><a href="${input.recordingUrl}">Listen to recording</a></p>` : ""}
${activityLink ? `<p><a href="${activityLink}">Open routing activity</a></p>` : ""}`;

  const targets: string[] = [];
  if (input.notifyEmail?.trim()) targets.push(input.notifyEmail.trim());

  if (targets.length) {
    const { sendTransactionalEmail } = await import("@/lib/email/brevo");
    for (const to of targets) {
      await sendTransactionalEmail({
        to,
        subject: `Voicemail from ${caller}`,
        htmlContent: html,
        textContent: `New voicemail from ${caller} on ${flowName}.`,
      });
    }
  } else {
    await notifyWorkspaceByEmail(input.workspaceId, {
      type: "smart_routing_voicemail",
      title: "New voicemail",
      subject: `Voicemail from ${caller}`,
      htmlContent: html,
      textContent: `New voicemail from ${caller} on ${flowName}.`,
      href: activityLink,
    });
  }
}
