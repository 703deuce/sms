import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { processIncomingIntegrationWebhook } from "@/lib/integrations/webhook-process";

type Ctx = { params: Promise<{ token: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params;
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const idempotencyKey =
      request.headers.get("idempotency-key") ||
      (typeof payload.idempotencyKey === "string" ? payload.idempotencyKey : undefined) ||
      (typeof payload.id === "string" ? payload.id : undefined);

    const result = await processIncomingIntegrationWebhook(token, payload, idempotencyKey);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
