import { NextResponse } from "next/server";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";
import { processTelnyxMeetingWebhook } from "@/lib/meeting-assistant/webhook-handler";

type TelnyxPayload = {
  data?: {
    event_type?: string;
    id?: string;
    payload?: Record<string, unknown>;
  };
};

export async function POST(request: Request) {
  const verified = await readTelnyxWebhook(request);
  if (!verified.ok) return verified.response;

  const body = verified.payload as TelnyxPayload;
  const eventType = body.data?.event_type || "unknown";
  const eventPayload = (body.data?.payload || {}) as Record<string, unknown>;

  const result = await processTelnyxMeetingWebhook({ eventType, eventPayload });
  return NextResponse.json({ ok: true, handled: result.handled, eventType });
}
