import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { findConnectionByWebhookToken } from "@/lib/integrations/connections";
import { ingestCalendlyWebhook, verifyCalendlySignature } from "@/lib/integrations/inbound";

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
    // Require configured signing key on the live path.
    if (!signingKey || !verifyCalendlySignature(signingKey, signature, rawBody)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody || "{}") as {
      event?: string;
      payload?: Record<string, unknown>;
    };
    const result = await ingestCalendlyWebhook(
      conn.workspaceId,
      body.event || "invitee.created",
      body.payload || {},
    );
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
