import { jsonError, requireSession } from "@/lib/api-auth";
import {
  resolveTransactionalEmailSenderConfig,
  sendTransactionalEmail,
} from "@/lib/email/brevo";
import { createVisualizerShare } from "@/lib/visualizer/share";
import { sendQuickSms } from "@/lib/sms/send-quick";

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const body = (await req.json()) as {
    projectId?: string;
    designId?: string;
    sendSms?: boolean;
    phone?: string;
    sendEmail?: boolean;
    email?: string;
    emailSubject?: string;
    expiresInDays?: number;
  };

  if (!body.projectId || !body.designId) {
    return jsonError("projectId and designId required", 400);
  }

  const expiresAt =
    body.expiresInDays && body.expiresInDays > 0
      ? new Date(Date.now() + body.expiresInDays * 86400_000)
      : null;

  const { shareId, url } = await createVisualizerShare({
    workspaceId: auth.workspaceId,
    projectId: body.projectId,
    designId: body.designId,
    createdByUserId: auth.session.userId,
    expiresAt,
  });

  let smsResult: unknown = null;
  if (body.sendSms && body.phone?.trim()) {
    const message = `Your bathroom remodel preview is ready. View your design: ${url}`;
    try {
      smsResult = await sendQuickSms({
        workspaceId: auth.workspaceId,
        to: body.phone.trim(),
        body: message,
        omitConsumerTrackingLink: true,
      });
    } catch (e) {
      return Response.json({
        shareId,
        url,
        smsError: e instanceof Error ? e.message : "SMS send failed",
      });
    }
  }

  let emailResult: unknown = null;
  if (body.sendEmail && body.email?.trim()) {
    const sender = resolveTransactionalEmailSenderConfig();
    if (!sender.productionReady) {
      return jsonError(
        "Email delivery is not configured. Set Brevo API key and a verified from address.",
        503,
      );
    }
    const subject = body.emailSubject?.trim() || "Your bathroom remodel preview";
    const html = `<p>Your bathroom remodel preview is ready.</p><p><a href="${url}">View your design</a></p>`;
    emailResult = await sendTransactionalEmail({
      to: body.email.trim(),
      subject,
      htmlContent: html,
      textContent: `Your bathroom remodel preview is ready: ${url}`,
      workspaceId: auth.workspaceId,
    });
    if (
      emailResult &&
      typeof emailResult === "object" &&
      "status" in emailResult &&
      (emailResult as { status: string }).status === "failed"
    ) {
      return Response.json({
        shareId,
        url,
        emailError: (emailResult as { error?: string }).error || "Email send failed",
      });
    }
  }

  return Response.json({ shareId, url, smsResult, emailResult });
}
