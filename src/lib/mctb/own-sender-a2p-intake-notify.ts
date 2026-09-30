import "server-only";

import { getPrisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/brevo";
import type { MctbOwnSenderA2pIntake } from "@/lib/mctb/own-sender-a2p-intake";

function opsRecipientEmails(): string[] {
  const raw =
    process.env.MCTB_OPS_NOTIFICATION_EMAIL?.trim() ||
    process.env.ADMIN_EMAILS?.trim() ||
    "";
  return raw
    .split(/[,;]/)
    .map((e) => e.trim())
    .filter(Boolean);
}

export async function notifyMctbOwnSenderA2pSubmitted(input: {
  workspaceId: string;
  intake: MctbOwnSenderA2pIntake;
}): Promise<void> {
  const recipients = opsRecipientEmails();
  if (recipients.length === 0) {
    console.warn(
      "[mctb] own-sender A2P submitted but no MCTB_OPS_NOTIFICATION_EMAIL or ADMIN_EMAILS configured",
    );
    return;
  }

  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { name: true, slug: true },
  });

  const lines = [
    `Workspace: ${ws?.name || input.workspaceId} (${input.workspaceId})`,
    `Legal name: ${input.intake.legalBusinessName}`,
    `EIN/Tax ID: ${input.intake.einOrTaxId || "—"}`,
    `Website: ${input.intake.businessWebsite || "—"}`,
    `Address: ${input.intake.businessAddressLine1}, ${input.intake.businessCity}, ${input.intake.businessState} ${input.intake.businessPostalCode}`,
    `Contact: ${input.intake.contactEmail} · ${input.intake.contactPhone || "—"}`,
    `Desired area code: ${input.intake.desiredAreaCode || "—"}`,
    `Use case: ${input.intake.useCaseDescription}`,
    ``,
    `Review in admin: /admin/a2p (MCTB Own Local Number queue)`,
    `Customer: /admin/customers/${input.workspaceId}`,
  ];

  for (const to of recipients) {
    await sendTransactionalEmail({
      to,
      subject: `MCTB Own Local Number A2P intake submitted — ${ws?.name || input.workspaceId}`,
      text: lines.join("\n"),
    });
  }
}
