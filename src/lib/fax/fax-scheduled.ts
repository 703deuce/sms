import "server-only";

import { getPrisma } from "@/lib/db";
import { createSignedFaxDocumentUrl } from "./fax-storage";
import { logFaxActivity } from "./fax-service";
import { sendTelnyxFax } from "./telnyx-fax-client";
import { mapFaxError } from "./fax-errors";

export async function sendScheduledFax(transmissionId: string) {
  const prisma = getPrisma();
  const transmission = await prisma.faxTransmission.findUnique({
    where: { id: transmissionId },
  });
  if (!transmission) return { ok: false, error: "not_found" };
  if (transmission.status !== "scheduled") return { ok: true, skipped: true };

  if (transmission.scheduledFor && transmission.scheduledFor.getTime() > Date.now()) {
    return { ok: true, deferred: true };
  }

  if (!transmission.documentStorageBucket || !transmission.documentStoragePath) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  const signedUrl = await createSignedFaxDocumentUrl(
    transmission.documentStorageBucket,
    transmission.documentStoragePath,
    7200,
  );

  try {
    const telnyx = await sendTelnyxFax({
      from: transmission.fromE164 || "",
      to: transmission.toE164 || "",
      mediaUrl: signedUrl,
      clientState: {
        workspaceId: transmission.workspaceId,
        transmissionId: transmission.id,
      },
    });
    await prisma.faxTransmission.update({
      where: { id: transmission.id },
      data: {
        telnyxFaxId: telnyx.id,
        status: "sending",
        sentAt: new Date(),
      },
    });
    await logFaxActivity({
      workspaceId: transmission.workspaceId,
      faxTransmissionId: transmission.id,
      eventType: "fax_submitted",
      message: `Scheduled fax submitted (Telnyx ${telnyx.id})`,
    });
    return { ok: true, telnyxFaxId: telnyx.id };
  } catch (err) {
    const message = mapFaxError(err instanceof Error ? err.message : String(err));
    await prisma.faxTransmission.update({
      where: { id: transmission.id },
      data: { status: "failed", failureReason: message, failedAt: new Date() },
    });
    throw new Error(message);
  }
}
