import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { findConnectionByWebhookToken } from "@/lib/integrations/connections";
import { ingestContactWebhook } from "@/lib/integrations/inbound";

export async function POST(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token") || "";
    const conn = await findConnectionByWebhookToken("shopify", token);
    if (!conn) return NextResponse.json({ error: "Unknown webhook token" }, { status: 404 });

    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await ingestContactWebhook(conn.workspaceId, "shopify", payload);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
