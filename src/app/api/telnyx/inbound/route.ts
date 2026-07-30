import { NextResponse } from "next/server";
import { readTelnyxWebhook, telnyxEventType } from "@/lib/messaging/telnyx/webhook-auth";
import {
  classifyTelnyxMessagingEvent,
  handleTelnyxInbound,
  handleTelnyxMessageStatus,
} from "@/lib/messaging/telnyx/webhook-handlers";

/** Legacy inbound URL — also routes status events if a profile still points here. */
export async function POST(request: Request) {
  try {
    const verified = await readTelnyxWebhook(request);
    if (!verified.ok) return verified.response;

    const eventType = telnyxEventType(verified.payload);
    const kind = classifyTelnyxMessagingEvent(eventType);

    if (kind === "status") {
      const result = await handleTelnyxMessageStatus(verified.payload);
      return NextResponse.json(result);
    }

    try {
      const result = await handleTelnyxInbound(verified.payload);
      return NextResponse.json(result);
    } catch (err) {
      const parsed = (verified.payload || {}) as {
        data?: { payload?: { text?: string } };
      };
      const body = String(parsed?.data?.payload?.text || "").toUpperCase();
      if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/.test(body)) {
        console.error("[telnyx/inbound] STOP persistence failed", err);
        return new NextResponse("STOP processing failed", { status: 500 });
      }
      throw err;
    }
  } catch (err) {
    console.error("[telnyx/inbound]", err);
    return new NextResponse("Inbound processing failed", { status: 500 });
  }
}
