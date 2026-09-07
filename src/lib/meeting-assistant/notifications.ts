import "server-only";

import { getPrisma } from "@/lib/db";
import { loadNotetakerConfig } from "./settings";

/** Notify organizer when meeting recap is ready (email when configured). */
export async function notifyMeetingRecapReady(
  workspaceId: string,
  meetingSessionId: string,
  appointmentId?: string | null,
) {
  const config = await loadNotetakerConfig(workspaceId);
  if (!config.emailOnRecapReady) return;

  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({
    where: { id: meetingSessionId, workspaceId },
  });
  if (!session) return;

  let recipientEmail: string | null = null;
  if (appointmentId) {
    const appt = await prisma.voiceAppointment.findFirst({
      where: { id: appointmentId, workspaceId },
    });
    const meta = (appt?.metadata || {}) as Record<string, unknown>;
    recipientEmail =
      typeof meta.inviteeEmail === "string" ? meta.inviteeEmail : null;
  }

  if (!recipientEmail) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    console.info(
      `[meeting-assistant] recap ready for ${workspace?.name || workspaceId} session ${meetingSessionId} (no organizer email on file)`,
    );
    return;
  }

  try {
    const { sendTransactionalEmail } = await import("@/lib/email/brevo");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
    await sendTransactionalEmail({
      to: recipientEmail,
      subject: `Meeting recap ready: ${session.title || "Your meeting"}`,
      htmlContent: `<p>Your meeting recap is ready.</p><p><a href="${baseUrl}/meetings/${meetingSessionId}">View recap</a></p>`,
      text: `Your meeting recap is ready.\n\nView recap: ${baseUrl}/meetings/${meetingSessionId}`,
    });
  } catch (err) {
    console.warn("[meeting-assistant] recap ready email failed", err);
  }
}
