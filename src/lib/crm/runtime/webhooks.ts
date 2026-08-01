/**
 * Inbound CRM webhook reliability: verify, dedupe, order, retry via queue.
 */

import { createHash, createHmac, timingSafeEqual } from "crypto";
import { getPrisma } from "@/lib/db";
import { enqueueCrmSync } from "../sync-engine";
import { writeCrmAudit } from "../logging";
import { redactSensitive } from "../redact";
import type { CrmProviderId } from "../types";
import { crmQueueName, priorityScoreForSyncKind } from "./priority";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

function fingerprintBody(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex").slice(0, 40);
}

export function verifyCrmWebhookSignature(input: {
  provider: CrmProviderId;
  rawBody: string;
  signatureHeader: string | null;
  secret: string | null;
}): { ok: boolean; reason?: string } {
  if (!input.secret) {
    // Secret not configured — accept but mark unverified (dev / optional).
    return { ok: true, reason: "unsigned_accepted" };
  }
  if (!input.signatureHeader) {
    return { ok: false, reason: "missing_signature" };
  }
  const expected = createHmac("sha256", input.secret).update(input.rawBody).digest("hex");
  const provided = input.signatureHeader.replace(/^sha256=/i, "").trim();
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: "invalid_signature" };
    }
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
  return { ok: true };
}

/** Replay window — reject events older than 15 minutes when timestamp present. */
export function assertWebhookFreshness(timestampHeader: string | null): {
  ok: boolean;
  reason?: string;
} {
  if (!timestampHeader) return { ok: true };
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return { ok: true };
  const ms = ts < 1e12 ? ts * 1000 : ts;
  if (Math.abs(Date.now() - ms) > 15 * 60 * 1000) {
    return { ok: false, reason: "stale_timestamp" };
  }
  return { ok: true };
}

export async function ingestCrmWebhook(input: {
  workspaceId: string;
  provider: CrmProviderId;
  eventType?: string | null;
  externalId?: string | null;
  headers: Record<string, string>;
  body: unknown;
  rawBody: string;
}) {
  const secret =
    process.env[`${input.provider.toUpperCase()}_WEBHOOK_SECRET`]?.trim() ||
    process.env.CRM_WEBHOOK_SECRET?.trim() ||
    null;

  const sig =
    input.headers["x-crm-signature"] ||
    input.headers["x-hub-signature-256"] ||
    input.headers["x-zoho-webhook-signature"] ||
    null;
  const verified = verifyCrmWebhookSignature({
    provider: input.provider,
    rawBody: input.rawBody,
    signatureHeader: sig,
    secret,
  });
  if (!verified.ok) {
    await writeCrmAudit({
      workspaceId: input.workspaceId,
      provider: input.provider,
      category: "webhook",
      action: "rejected",
      message: verified.reason || "signature failed",
    });
    return { accepted: false, reason: verified.reason };
  }

  const fresh = assertWebhookFreshness(
    input.headers["x-crm-timestamp"] || input.headers["x-request-timestamp"] || null,
  );
  if (!fresh.ok) {
    return { accepted: false, reason: fresh.reason };
  }

  const fp = input.externalId || fingerprintBody(input.body);
  const prisma = getPrisma();

  // Deduplication
  const existing = await prisma.crmWebhookEvent.findFirst({
    where: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      externalId: fp,
      status: { in: ["pending", "processing", "completed"] },
    },
  });
  if (existing) {
    await writeCrmAudit({
      workspaceId: input.workspaceId,
      provider: input.provider,
      category: "webhook",
      action: "deduped",
      message: `Duplicate webhook ${fp}`,
      detail: { webhookEventId: existing.id },
    });
    return { accepted: true, deduped: true, webhookEventId: existing.id };
  }

  const row = await prisma.crmWebhookEvent.create({
    data: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      status: "pending",
      eventType: input.eventType || "unknown",
      externalId: fp,
      payloadJson: redactSensitive(input.body) as object,
    },
  });

  // Enqueue ordered processing (same external entity serializes via idempotency prefix)
  await enqueueJob({
    jobType: "crm_webhook_process",
    queueName: crmQueueName(input.provider),
    workspaceId: input.workspaceId,
    priority: priorityScoreForSyncKind("webhook"),
    payload: {
      workspaceId: input.workspaceId,
      provider: input.provider,
      webhookEventId: row.id,
    },
    idempotencyKey: `crm-wh-proc-${input.provider}-${row.id}`,
  });

  await writeCrmAudit({
    workspaceId: input.workspaceId,
    provider: input.provider,
    category: "webhook",
    action: "accepted",
    message: `Webhook queued (${input.eventType || "unknown"})`,
    detail: { webhookEventId: row.id, verified: verified.reason || "ok" },
  });

  return { accepted: true, deduped: false, webhookEventId: row.id };
}

export async function processCrmWebhookJob(payload: {
  workspaceId: string;
  provider: CrmProviderId;
  webhookEventId: string;
}) {
  const prisma = getPrisma();
  const row = await prisma.crmWebhookEvent.findFirst({
    where: {
      id: payload.webhookEventId,
      workspaceId: payload.workspaceId,
      provider: payload.provider,
    },
  });
  if (!row) return { ok: false, reason: "not_found" };
  if (row.status === "completed") return { ok: true, deduped: true };

  await prisma.crmWebhookEvent.update({
    where: { id: row.id },
    data: { status: "processing", attempts: { increment: 1 } },
  });

  try {
    // Trigger incremental sync — adapters may refine handleWebhook later.
    const { getConnector } = await import("../registry");
    const { ensureFreshCrmToken } = await import("../oauth");
    const { getCrmSyncPreferences } = await import("../settings");
    const connector = getConnector(payload.provider);
    if (connector.handleWebhook) {
      const conn = await ensureFreshCrmToken(payload.workspaceId, payload.provider);
      if (conn?.accessToken) {
        await connector.handleWebhook(
          {
            workspaceId: payload.workspaceId,
            accessToken: conn.accessToken,
            refreshToken: conn.refreshToken,
            meta: (conn.configJson || {}) as Record<string, unknown>,
            preferences: await getCrmSyncPreferences(payload.workspaceId, payload.provider),
          },
          {},
          row.payloadJson,
        );
      }
    } else {
      await enqueueCrmSync({
        workspaceId: payload.workspaceId,
        provider: payload.provider,
        kind: "webhook",
        triggeredBy: "webhook",
      });
    }

    await prisma.crmWebhookEvent.update({
      where: { id: row.id },
      data: { status: "completed", processedAt: new Date() },
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const attempts = row.attempts + 1;
    await prisma.crmWebhookEvent.update({
      where: { id: row.id },
      data: {
        status: attempts >= 8 ? "dead" : "failed",
        lastError: message.slice(0, 500),
      },
    });
    if (attempts < 8) {
      const { JobDeferredError } = await import("@/lib/messaging/types");
      throw new JobDeferredError(`crm_webhook_retry:${message.slice(0, 80)}`, Math.min(60_000 * attempts, 900_000));
    }
    throw err;
  }
}
