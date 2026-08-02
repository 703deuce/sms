import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import {
  findConnectionByWebhookToken,
  getConnection,
  upsertConnection,
} from "@/lib/integrations/connections";
import {
  enqueueIntegrationWebhookProcess,
  getAdapter,
  isExternalProvider,
} from "@/lib/integrations/framework";

async function recordWebhookHit(input: {
  workspaceId: string;
  provider: string;
  status: number;
  reason: string;
}) {
  try {
    const conn = await getConnection(input.workspaceId, input.provider);
    if (!conn) return;
    const cfg = (conn.configJson || {}) as Record<string, unknown>;
    await upsertConnection({
      workspaceId: input.workspaceId,
      provider: input.provider,
      mergeConfig: true,
      config: {
        lastWebhookHitAt: new Date().toISOString(),
        lastWebhookHitStatus: input.status,
        lastWebhookHitReason: input.reason.slice(0, 180),
        webhookHitCount: Number(cfg.webhookHitCount || 0) + 1,
      },
    });
  } catch (err) {
    console.warn(
      "[native webhook] hit record failed",
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Inbound provider webhooks.
 * Prefer ?token= workspace webhook token; some providers POST to a shared URL
 * and we resolve via signed payload / stored connection.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: raw } = await context.params;
  if (!isExternalProvider(raw)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const rawBody = await request.text();
  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    payload = { raw: rawBody };
  }

  let workspaceId: string | null = null;
  if (token) {
    const conn = await findConnectionByWebhookToken(raw, token);
    workspaceId = conn?.workspaceId || null;
  }

  // Fallback: single connected workspace for this provider (dev / PIT)
  if (!workspaceId) {
    const rows = await getPrisma().integrationConnection.findMany({
      where: { provider: raw, status: "connected" },
      take: 2,
    });
    if (rows.length === 1) workspaceId = rows[0].workspaceId;
  }

  if (!workspaceId) {
    return NextResponse.json({ error: "Unable to route webhook" }, { status: 400 });
  }

  const adapter = getAdapter(raw);
  const conn = await getConnection(workspaceId, raw);
  const cfg = (conn?.configJson || {}) as Record<string, unknown>;
  let secret: string | null =
    (typeof cfg.signingKey === "string" && cfg.signingKey.trim()) ||
    process.env[`${raw.toUpperCase()}_WEBHOOK_SECRET`]?.trim() ||
    null;
  if (raw === "calendly") {
    // Try every candidate (OAuth app env key + optional captured/legacy config).
    const {
      resolveCalendlyWebhookSigningKeys,
      calendlyAdapter,
    } = await import("@/lib/integrations/adapters/calendly");
    const keys = resolveCalendlyWebhookSigningKeys(cfg);
    if (!keys.length) {
      await recordWebhookHit({
        workspaceId,
        provider: raw,
        status: 401,
        reason: "missing_signing_key",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    let ok = false;
    for (const key of keys) {
      if (await calendlyAdapter.verifyWebhook?.(request.headers, rawBody, key)) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      await recordWebhookHit({
        workspaceId,
        provider: raw,
        status: 401,
        reason: "invalid_signature",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (adapter.verifyWebhook) {
    const ok = await adapter.verifyWebhook(request.headers, rawBody, secret);
    if (!ok) {
      await recordWebhookHit({
        workspaceId,
        provider: raw,
        status: 401,
        reason: "invalid_signature",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const externalId =
    (typeof payload === "object" &&
      payload &&
      ("id" in payload || "token" in payload) &&
      String(
        (payload as { id?: unknown; token?: unknown }).id ||
          (payload as { token?: unknown }).token ||
          "",
      )) ||
    `wh-${Date.now()}`;

  const row = await getPrisma().crmWebhookEvent.create({
    data: {
      workspaceId,
      provider: raw,
      status: "pending",
      eventType: "inbound",
      externalId: `${raw}:${externalId}:${Date.now()}`,
      payloadJson: payload as object,
    },
  });

  await enqueueIntegrationWebhookProcess({
    workspaceId,
    provider: raw,
    webhookEventId: row.id,
  });

  await recordWebhookHit({
    workspaceId,
    provider: raw,
    status: 200,
    reason: "accepted",
  });

  return NextResponse.json({ ok: true, id: row.id });
}
