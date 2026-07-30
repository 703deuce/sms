import { NextResponse } from "next/server";
import { readTelnyxWebhook, telnyxEventType } from "@/lib/messaging/telnyx/webhook-auth";
import {
  classifyTelnyxMessagingEvent,
  handleTelnyxInbound,
  handleTelnyxMessageStatus,
} from "@/lib/messaging/telnyx/webhook-handlers";

/**
 * Unified messaging-profile webhook.
 * Telnyx profiles deliver message.received and delivery lifecycle events to one URL.
 */
export async function POST(request: Request) {
  try {
    const verified = await readTelnyxWebhook(request);
    if (!verified.ok) return verified.response;

    const eventType = telnyxEventType(verified.payload);
    const kind = classifyTelnyxMessagingEvent(eventType);

    if (kind === "inbound") {
      try {
        const result = await handleTelnyxInbound(verified.payload);
        return NextResponse.json(result);
      } catch (err) {
        const parsed = (verified.payload || {}) as {
          data?: { payload?: { text?: string } };
        };
        const body = String(parsed?.data?.payload?.text || "").toUpperCase();
        if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/.test(body)) {
          console.error("[telnyx/messaging] STOP persistence failed", err);
          return new NextResponse("STOP processing failed", { status: 500 });
        }
        throw err;
      }
    }

    if (kind === "status") {
      const result = await handleTelnyxMessageStatus(verified.payload);
      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: true, skipped: true, eventType: eventType || null });
  } catch (err) {
    console.error("[telnyx/messaging]", err);
    return new NextResponse("Messaging webhook failed", { status: 500 });
  }
}
