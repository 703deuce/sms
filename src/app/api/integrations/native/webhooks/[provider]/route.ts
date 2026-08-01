import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { findConnectionByWebhookToken, getConnection } from "@/lib/integrations/connections";
import {
  enqueueIntegrationWebhookProcess,
  getAdapter,
  isExternalProvider,
} from "@/lib/integrations/framework";

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
  const secret =
    ((conn?.configJson as Record<string, unknown> | null)?.signingKey as string) ||
    process.env[`${raw.toUpperCase()}_WEBHOOK_SECRET`] ||
    null;

  if (adapter.verifyWebhook) {
    const ok = await adapter.verifyWebhook(request.headers, rawBody, secret);
    if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
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

  return NextResponse.json({ ok: true, id: row.id });
}
