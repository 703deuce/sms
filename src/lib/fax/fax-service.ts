import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { assertFaxEntitlement } from "./fax-entitlements";
import { uploadFaxDocument, createSignedFaxDocumentUrl, downloadFaxDocument } from "./fax-storage";
import {
  sanitizeFilename,
  validateFaxDocument,
  validateFaxRecipient,
  estimatePdfPageCount,
} from "./fax-validation";
import { assertFaxPageAllowance, getOrCreateFaxAccount } from "./fax-usage";
import { sendTelnyxFax } from "./telnyx-fax-client";
import { mapFaxError } from "./fax-errors";
import { computeFaxPageAccounting, mergePageAccountingIntoMetadata } from "./fax-pages";
import { mapToFaxDisplayStatus } from "./fax-status";

export async function logFaxActivity(input: {
  workspaceId: string;
  faxTransmissionId: string;
  eventType: string;
  message?: string;
  actorUserId?: string;
  metadata?: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  await prisma.faxActivityLog.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      faxTransmissionId: input.faxTransmissionId,
      eventType: input.eventType,
      message: input.message,
      actorUserId: input.actorUserId,
      metadataJson: (input.metadata || {}) as object,
    },
  });
}

export async function sendOutboundFax(input: {
  workspaceId: string;
  fromE164: string;
  toE164: string;
  documentBytes: Buffer;
  mimeType?: string;
  filename?: string;
  recipientName?: string;
  faxNumberId?: string;
  userId?: string;
  scheduledFor?: Date | null;
}) {
  await assertFaxEntitlement(input.workspaceId);

  const recipient = validateFaxRecipient(input.toE164);
  if (!recipient.ok) throw new Error(recipient.error);

  const docCheck = validateFaxDocument({
    bytes: input.documentBytes,
    mimeType: input.mimeType,
    filename: input.filename,
  });
  if (!docCheck.ok) throw new Error(docCheck.error);

  const estimatedPages = (await estimatePdfPageCount(input.documentBytes)) || 1;
  const accounting = computeFaxPageAccounting(estimatedPages);
  await assertFaxPageAllowance(input.workspaceId, accounting.billablePages);

  const prisma = getPrisma();
  const account = await getOrCreateFaxAccount(input.workspaceId);
  const transmissionId = createId();

  const stored = await uploadFaxDocument({
    workspaceId: input.workspaceId,
    transmissionId,
    bytes: input.documentBytes,
    mimeType: input.mimeType || "application/pdf",
  });

  const signedUrl = await createSignedFaxDocumentUrl(stored.bucket, stored.path, 7200);

  const transmission = await prisma.faxTransmission.create({
    data: {
      id: transmissionId,
      workspaceId: input.workspaceId,
      faxAccountId: account.id,
      faxNumberId: input.faxNumberId || null,
      direction: "outbound",
      status: input.scheduledFor ? "scheduled" : "queued",
      fromE164: input.fromE164,
      toE164: recipient.e164,
      recipientName: input.recipientName || null,
      documentStorageBucket: stored.bucket,
      documentStoragePath: stored.path,
      documentMimeType: input.mimeType || "application/pdf",
      documentFilename: sanitizeFilename(input.filename || "document.pdf"),
      documentSizeBytes: input.documentBytes.length,
      scheduledFor: input.scheduledFor || null,
      folder: "sent",
      pageCount: accounting.documentPages,
      metadataJson: mergePageAccountingIntoMetadata(
        { estimatedPages: accounting.documentPages, displayStatus: input.scheduledFor ? "scheduled" : "preparing" },
        accounting,
      ) as object,
    },
  });

  await logFaxActivity({
    workspaceId: input.workspaceId,
    faxTransmissionId: transmission.id,
    eventType: "fax_queued",
    message: "Fax queued for delivery",
    actorUserId: input.userId,
  });

  if (input.scheduledFor && input.scheduledFor.getTime() > Date.now()) {
    await enqueueJob({
      jobType: "fax_send_scheduled",
      queueName: "automations",
      workspaceId: input.workspaceId,
      payload: { transmissionId: transmission.id },
      idempotencyKey: `fax-scheduled:${transmission.id}`,
      runAfter: input.scheduledFor,
    });
    return transmission;
  }

  try {
    const telnyx = await sendTelnyxFax({
      from: input.fromE164,
      to: recipient.e164,
      mediaUrl: signedUrl,
      clientState: { workspaceId: input.workspaceId, transmissionId: transmission.id },
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
      workspaceId: input.workspaceId,
      faxTransmissionId: transmission.id,
      eventType: "fax_submitted",
      message: `Submitted to carrier (Telnyx ${telnyx.id})`,
    });
  } catch (err) {
    const message = mapFaxError(err instanceof Error ? err.message : String(err));
    await prisma.faxTransmission.update({
      where: { id: transmission.id },
      data: { status: "failed", failureReason: message, failedAt: new Date() },
    });
    throw new Error(message);
  }

  return transmission;
}

export async function getFaxTransmission(workspaceId: string, id: string) {
  const prisma = getPrisma();
  return prisma.faxTransmission.findFirst({
    where: { id, workspaceId },
    include: { intelligence: true, faxNumber: true },
  });
}

export async function listFaxTransmissions(
  workspaceId: string,
  filter: { direction?: string; folder?: string; status?: string; limit?: number } = {},
) {
  const prisma = getPrisma();
  return prisma.faxTransmission.findMany({
    where: {
      workspaceId,
      ...(filter.direction ? { direction: filter.direction } : {}),
      ...(filter.folder ? { folder: filter.folder } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    include: { intelligence: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, filter.limit || 50),
  });
}

export async function getFaxDocumentSignedUrl(workspaceId: string, transmissionId: string) {
  const tx = await getFaxTransmission(workspaceId, transmissionId);
  if (!tx?.documentStorageBucket || !tx.documentStoragePath) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }
  return createSignedFaxDocumentUrl(tx.documentStorageBucket, tx.documentStoragePath, 3600);
}

export async function retryOutboundFax(workspaceId: string, transmissionId: string, userId?: string) {
  const prisma = getPrisma();
  const original = await getFaxTransmission(workspaceId, transmissionId);
  if (!original || original.direction !== "outbound") throw new Error("FAX_NOT_FOUND");
  if (!original.documentStorageBucket || !original.documentStoragePath) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }

  const bytes = await downloadFaxDocument(
    original.documentStorageBucket,
    original.documentStoragePath,
  );

  return sendOutboundFax({
    workspaceId,
    fromE164: original.fromE164 || "",
    toE164: original.toE164 || "",
    documentBytes: bytes,
    mimeType: original.documentMimeType || "application/pdf",
    filename: original.documentFilename || "document.pdf",
    recipientName: original.recipientName || undefined,
    faxNumberId: original.faxNumberId || undefined,
    userId,
  });
}

export async function searchFaxTransmissions(
  workspaceId: string,
  query: string,
  limit = 50,
) {
  const prisma = getPrisma();
  const q = query.trim();
  if (!q) return listFaxTransmissions(workspaceId, { limit });

  return prisma.faxTransmission.findMany({
    where: {
      workspaceId,
      OR: [
        { fromE164: { contains: q } },
        { toE164: { contains: q } },
        { recipientName: { contains: q, mode: "insensitive" } },
        { documentFilename: { contains: q, mode: "insensitive" } },
        {
          intelligence: {
            is: {
              OR: [
                { searchText: { contains: q, mode: "insensitive" } },
                { aiSummary: { contains: q, mode: "insensitive" } },
                { documentType: { contains: q, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
    },
    include: { intelligence: true },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, limit),
  });
}
