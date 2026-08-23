import { getPrisma } from "@/lib/db";
import { notifyWorkspace } from "@/lib/notifications/in-app";
import { sendTransactionalEmail } from "@/lib/email/brevo";

export type CallbackStatus = "new" | "contacted" | "completed" | "dismissed";

export async function createCallbackRequest(input: {
  workspaceId: string;
  callerE164: string;
  businessE164?: string | null;
  phoneNumberId?: string | null;
  smartRoutingSessionId?: string | null;
  sourceRoute?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const row = await prisma.callbackRequest.create({
    data: {
      workspaceId: input.workspaceId,
      callerE164: input.callerE164,
      businessE164: input.businessE164 ?? null,
      phoneNumberId: input.phoneNumberId ?? null,
      smartRoutingSessionId: input.smartRoutingSessionId ?? null,
      sourceRoute: input.sourceRoute ?? null,
      reason: input.reason ?? null,
      status: "new",
      metadata: input.metadata ?? undefined,
    },
  });

  await notifyWorkspace(input.workspaceId, {
    type: "callback_request",
    title: "New callback request",
    body: `Caller ${input.callerE164}${input.sourceRoute ? ` — ${input.sourceRoute}` : ""}`,
    href: "/voice/callback-requests",
  }).catch(() => undefined);

  const prismaMembers = getPrisma();
  const workspace = await prismaMembers.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true, ownerUserId: true },
  });
  if (workspace?.ownerUserId) {
    const owner = await prismaMembers.user.findUnique({
      where: { id: workspace.ownerUserId },
      select: { email: true },
    });
    if (owner?.email) {
      const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";
      await sendTransactionalEmail({
        to: owner.email,
        subject: `Callback request from ${input.callerE164}`,
        htmlContent: `<p>A caller requested a callback for <strong>${workspace.name}</strong>.</p>
<p>Caller: ${input.callerE164}</p>
${input.sourceRoute ? `<p>Route: ${input.sourceRoute}</p>` : ""}
${appUrl ? `<p><a href="${appUrl}/voice/callback-requests">View callback requests</a></p>` : ""}`,
        textContent: `Callback request from ${input.callerE164} for ${workspace.name}.`,
      }).catch(() => undefined);
    }
  }

  return row;
}

export async function updateCallbackRequestStatus(
  workspaceId: string,
  id: string,
  status: CallbackStatus,
) {
  const prisma = getPrisma();
  const patch: Record<string, Date | string> = { status };
  if (status === "contacted") patch.contactedAt = new Date();
  if (status === "completed") patch.completedAt = new Date();
  if (status === "dismissed") patch.dismissedAt = new Date();
  return prisma.callbackRequest.update({
    where: { id, workspaceId },
    data: patch,
  });
}
