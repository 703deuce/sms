import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { findConnectionByWebhookToken } from "@/lib/integrations/connections";
import { verifyCalendlySignature } from "@/lib/integrations/inbound";
import { enqueueIntegrationWebhookProcess } from "@/lib/integrations/framework/sync";

/**
 * Legacy Calendly webhook URL — forwards into the normalized integration pipeline
 * so flow-builder integration triggers fire (not just appointment upsert).
 */
export async function POST(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const conn = await findConnectionByWebhookToken("calendly", token);
    if (!conn) return NextResponse.json({ error: "Unknown webhook token" }, { status: 404 });

    const rawBody = await request.text();
    const { resolveCalendlyWebhookSigningKey } = await import(
      "@/lib/integrations/adapters/calendly"
    );
    const signingKey = resolveCalendlyWebhookSigningKey(
      (conn.configJson || {}) as Record<string, unknown>,
    );
    const signature = request.headers.get("calendly-webhook-signature");
    if (!signingKey || !verifyCalendlySignature(signingKey, signature, rawBody)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody || "{}") as {
      event?: string;
      payload?: Record<string, unknown>;
    };

    const externalId =
      (typeof body.payload?.uri === "string" && body.payload.uri) ||
      `${body.event || "invitee.created"}:${Date.now()}`;

    const row = await getPrisma().crmWebhookEvent.create({
      data: {
        workspaceId: conn.workspaceId,
        provider: "calendly",
        status: "pending",
        eventType: body.event || "invitee.created",
        externalId: `calendly:${externalId}`,
        payloadJson: body as object,
      },
    });

    await enqueueIntegrationWebhookProcess({
      workspaceId: conn.workspaceId,
      provider: "calendly",
      webhookEventId: row.id,
    });

    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    return jsonError(err, 400);
  }
}
