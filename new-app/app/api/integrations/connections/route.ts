import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  disconnectConnection,
  isStripeEnvConfigured,
  listConnections,
} from "@/lib/integrations/connections";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const connections = await listConnections(auth.workspaceId);
    return NextResponse.json({
      data: { connections, stripeEnvConfigured: isStripeEnvConfigured() },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      provider?: string;
      action?: "connect" | "disconnect" | "sync" | "oauth";
    };
    const provider = body.provider?.trim();
    const action = body.action || "connect";
    if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 });

    if (action === "disconnect") {
      await disconnectConnection(auth.workspaceId, provider);
      return NextResponse.json({ data: { ok: true } });
    }

    if (action === "sync" || action === "oauth" || action === "connect") {
      return NextResponse.json(
        { error: `Use provider-specific connect flow for ${provider}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
