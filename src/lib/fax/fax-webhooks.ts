import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { downloadFaxDocument, uploadFaxDocument } from "./fax-storage";
import { logFaxActivity } from "./fax-service";
import { mapTelnyxFaxStatus } from "./telnyx-fax-client";
import { recordFaxPageUsage } from "./fax-usage";
import { computeFaxPageAccounting, mergePageAccountingIntoMetadata } from "./fax-pages";
import { mapToFaxDisplayStatus } from "./fax-status";
import { mapFaxError } from "./fax-errors";
import { isSenderBlocked } from "./fax-blocked-senders";
import type { TelnyxFaxPayload } from "./types";

function decodeClientState(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function processTelnyxFaxWebhook(input: {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const prisma = getPrisma();
  const existing = await prisma.faxWebhookEvent.findUnique({
    where: { telnyxEventId: input.eventId },
  });
  if (existing?.processedAt) {
    return { ok: true, duplicate: true };
  }

  const faxPayload = (input.payload.payload || input.payload) as TelnyxFaxPayload;
  const telnyxFaxId = String(faxPayload.id || input.payload.id || "");
  const clientState = decodeClientState(
    String((input.payload as { client_state?: string }).client_state || ""),
  );
  const workspaceId = String(clientState.workspaceId || "");
  const transmissionId = String(clientState.transmissionId || "");

  const webhookRow = await prisma.faxWebhookEvent.upsert({
    where: { telnyxEventId: input.eventId },
    create: {
      id: createId(),
      workspaceId: workspaceId || null,
      telnyxEventId: input.eventId,
      eventType: input.eventType,
      telnyxFaxId: telnyxFaxId || null,
      faxTransmissionId: transmissionId || null,
      payloadJson: input.payload as object,
    },
    update: {},
  });

  const status = mapTelnyxFaxStatus(faxPayload.status || input.eventType);
  let transmission =
    transmissionId
      ? await prisma.faxTransmission.findFirst({ where: { id: transmissionId } })
      : telnyxFaxId
        ? await prisma.faxTransmission.findFirst({ where: { telnyxFaxId } })
        : null;

  if (!transmission && faxPayload.direction === "inbound") {
    transmission = await handleInboundFax(faxPayload, input.eventType);
  }

  if (!transmission) {
    await prisma.faxWebhookEvent.update({
      where: { id: webhookRow.id },
      data: { processedAt: new Date() },
    });
    return { ok: true, unmatched: true };
  }

  const pageCount = faxPayload.page_count ?? transmission.pageCount ?? 1;
  const accounting = computeFaxPageAccounting(pageCount);
  const existingMeta = (transmission.metadataJson || {}) as Record<string, unknown>;
  const displayStatus = mapToFaxDisplayStatus({
    status,
    eventType: input.eventType,
    direction: transmission.direction,
  });

  const patch: Record<string, unknown> = {
    status,
    pageCount: accounting.documentPages,
    telnyxFaxId: telnyxFaxId || transmission.telnyxFaxId,
    metadataJson: mergePageAccountingIntoMetadata(
      { ...existingMeta, displayStatus, providerStatus: faxPayload.status || status },
      accounting,
    ),
  };

  if (status === "delivered") patch.deliveredAt = new Date();
  if (status === "failed") {
    patch.failedAt = new Date();
    patch.failureReason = mapFaxError(faxPayload.failure_reason || "Delivery failed");
    patch.failureCode = String(faxPayload.failure_reason || "").slice(0, 120);
  }
  if (status === "received") patch.receivedAt = new Date();

  await prisma.faxTransmission.update({
    where: { id: transmission.id },
    data: patch as never,
  });

  if ((status === "delivered" || status === "received") && accounting.billablePages > 0) {
    await recordFaxPageUsage({
      workspaceId: transmission.workspaceId,
      pages: accounting.billablePages,
      idempotencyKey: `fax-pages:${input.eventId}`,
    });
  }

  await logFaxActivity({
    workspaceId: transmission.workspaceId,
    faxTransmissionId: transmission.id,
    eventType: `webhook_${status}`,
    message: `Carrier status: ${status}`,
    metadata: { eventType: input.eventType, telnyxFaxId },
  });

  if (transmission.direction === "inbound" && status === "received") {
    const blocked = await isSenderBlocked(transmission.workspaceId, transmission.fromE164 || "");
    const skipAi = blocked || transmission.isSpam;
    if (!skipAi) {
      await enqueueJob({
        jobType: "fax_intelligence_process",
        queueName: "automations",
        workspaceId: transmission.workspaceId,
        payload: { transmissionId: transmission.id },
        idempotencyKey: `fax-intel:${transmission.id}`,
        runAfter: new Date(),
      });
    }
    await maybeNotifyInboundFax(transmission.workspaceId, transmission.id);
  }

  await prisma.faxWebhookEvent.update({
    where: { id: webhookRow.id },
    data: {
      processedAt: new Date(),
      faxTransmissionId: transmission.id,
      workspaceId: transmission.workspaceId,
    },
  });

  return { ok: true, transmissionId: transmission.id, status };
}

async function handleInboundFax(faxPayload: TelnyxFaxPayload, eventType: string) {
  const prisma = getPrisma();
  const toE164 = String(faxPayload.to || "");
  if (!toE164) return null;

  const faxNumber = await prisma.faxNumber.findFirst({
    where: { e164: toE164, status: "active" },
    include: { account: true },
  });
  if (!faxNumber) return null;

  const blocked = await prisma.faxBlockedSender.findFirst({
    where: { workspaceId: faxNumber.workspaceId, faxE164: String(faxPayload.from || "") },
  });

  const pageAccounting = computeFaxPageAccounting(faxPayload.page_count ?? 1);

  const transmissionId = createId();
  let bucket: string | null = null;
  let path: string | null = null;

  if (faxPayload.media_url) {
    try {
      const res = await fetch(faxPayload.media_url);
      if (res.ok) {
        const bytes = Buffer.from(await res.arrayBuffer());
        const stored = await uploadFaxDocument({
          workspaceId: faxNumber.workspaceId,
          transmissionId,
          bytes,
          mimeType: "application/pdf",
        });
        bucket = stored.bucket;
        path = stored.path;
      }
    } catch {
      // document fetch failed — metadata still persisted
    }
  }

  const transmission = await prisma.faxTransmission.create({
    data: {
      id: transmissionId,
      workspaceId: faxNumber.workspaceId,
      faxAccountId: faxNumber.faxAccountId,
      faxNumberId: faxNumber.id,
      direction: "inbound",
      status: blocked ? "received" : "received",
      fromE164: faxPayload.from || null,
      toE164,
      telnyxFaxId: faxPayload.id,
      pageCount: pageAccounting.documentPages,
      receivedAt: new Date(),
      folder: blocked ? "spam" : "inbox",
      isSpam: Boolean(blocked),
      documentStorageBucket: bucket,
      documentStoragePath: path,
      documentMimeType: bucket ? "application/pdf" : null,
      metadataJson: mergePageAccountingIntoMetadata({ eventType, blockedSender: Boolean(blocked) }, pageAccounting),
    },
  });

  await logFaxActivity({
    workspaceId: faxNumber.workspaceId,
    faxTransmissionId: transmission.id,
    eventType: "fax_received",
    message: blocked ? "Inbound fax from blocked sender" : "Inbound fax received",
  });

  return transmission;
}

async function maybeNotifyInboundFax(workspaceId: string, transmissionId: string) {
  const prisma = getPrisma();
  const account = await prisma.faxAccount.findUnique({ where: { workspaceId } });
  if (!account?.notifyOnInbound || !account.notifyEmail) return;

  const tx = await prisma.faxTransmission.findFirst({
    where: { id: transmissionId, workspaceId },
    include: { intelligence: true },
  });
  if (!tx) return;

  const appUrl = process.env.APP_URL?.replace(/\/$/, "") || "";
  const { sendTransactionalEmail } = await import("@/lib/email/brevo");
  await sendTransactionalEmail({
    to: account.notifyEmail,
    subject: `New fax from ${tx.fromE164 || "unknown"}`,
    htmlContent: `<p>You received a new fax (${tx.pageCount || "?"} pages).</p>
${tx.intelligence?.aiSummary ? `<p><strong>Summary:</strong> ${tx.intelligence.aiSummary}</p>` : ""}
${appUrl ? `<p><a href="${appUrl}/fax/inbox">View in Transovo Fax</a></p>` : ""}`,
    textContent: `New fax from ${tx.fromE164 || "unknown"}.`,
  }).catch(() => undefined);
}
