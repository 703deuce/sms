import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { applyRecipientSuppressionMetadata } from "@/lib/appointment-reminders/ar-recipient-suppression-metadata";

export { applyRecipientSuppressionMetadata };

export async function isWorkspacePhoneSuppressed(
  workspaceId: string,
  phoneE164: string | null | undefined,
): Promise<boolean> {
  const phone = phoneE164?.trim();
  if (!phone) return false;
  const prisma = getPrisma();
  const row = await prisma.suppression.findFirst({
    where: { workspaceId, phone },
    select: { id: true },
  });
  if (row) return true;

  const contact = await prisma.contact.findFirst({
    where: { workspaceId, phone },
    select: { status: true },
  });
  return contact?.status === "UNSUBSCRIBED" || contact?.status === "BLOCKED";
}

export async function enrichImportMetadataWithRecipientSuppression(
  workspaceId: string,
  phone: string | null | undefined,
  meta: AppointmentMetadata,
): Promise<AppointmentMetadata> {
  if (!phone) return meta;
  const suppressed = await isWorkspacePhoneSuppressed(workspaceId, phone);
  return applyRecipientSuppressionMetadata(meta, suppressed);
}
