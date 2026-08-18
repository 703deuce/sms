import { NextResponse } from "next/server";
import { handleTelnyxPortOutWebhook } from "@/lib/numbers/telnyx-port-out-service";

/**
 * Telnyx port-out notification webhook (portout.status_changed, etc.)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      data?: {
        event_type?: string;
        payload?: Record<string, unknown>;
      };
    };
    const eventType = body.data?.event_type || "unknown";
    const payload = {
      ...(body.data?.payload || {}),
      event_type: eventType,
    } as Record<string, unknown>;

    const result = await handleTelnyxPortOutWebhook(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[telnyx/port-out]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "telnyx-port-out-webhook" });
}
