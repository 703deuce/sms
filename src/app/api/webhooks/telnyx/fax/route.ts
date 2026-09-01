import { NextResponse } from "next/server";
import { readTelnyxWebhook, telnyxEventType } from "@/lib/messaging/telnyx/webhook-auth";
import { processTelnyxFaxWebhook } from "@/lib/fax/fax-webhooks";

export async function POST(request: Request) {
  try {
    const verified = await readTelnyxWebhook(request);
    if (!verified.ok) return verified.response;

    const eventType = telnyxEventType(verified.payload);
    const payload = verified.payload as { data?: { id?: string; payload?: Record<string, unknown> } };
    const eventId =
      String((payload?.data as { id?: string } | undefined)?.id || (verified.payload as { id?: string })?.id || `${eventType}:${Date.now()}`);

    const result = await processTelnyxFaxWebhook({
      eventId,
      eventType,
      payload: (payload?.data?.payload || payload?.data || verified.payload) as Record<string, unknown>,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[telnyx/fax]", err);
    return new NextResponse("Fax webhook processing failed", { status: 500 });
  }
}
