import { NextResponse } from "next/server";
import { readTelnyxWebhook, telnyxEventType } from "@/lib/messaging/telnyx/webhook-auth";
import {
  classifyTelnyxMessagingEvent,
  handleTelnyxInbound,
  handleTelnyxMessageStatus,
} from "@/lib/messaging/telnyx/webhook-handlers";

/** Legacy status URL — also accepts inbound if misconfigured. */
export async function POST(request: Request) {
  try {
    const verified = await readTelnyxWebhook(request);
    if (!verified.ok) return verified.response;

    const eventType = telnyxEventType(verified.payload);
    const kind = classifyTelnyxMessagingEvent(eventType);

    if (kind === "inbound") {
      const result = await handleTelnyxInbound(verified.payload);
      return NextResponse.json(result);
    }

    const result = await handleTelnyxMessageStatus(verified.payload);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[telnyx/message-status]", err);
    return new NextResponse("Status processing failed", { status: 500 });
  }
}
