import { jsonError, requireSession } from "@/lib/api-auth";
import { resolveTransactionalEmailSenderConfig } from "@/lib/email/brevo";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const email = resolveTransactionalEmailSenderConfig();
  return Response.json({
    sms: true,
    email: email.productionReady,
    emailReason: email.productionReady
      ? null
      : "Transactional email is not configured (Brevo API key and verified from address).",
  });
}
