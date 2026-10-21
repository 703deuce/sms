import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import { handleTelnyxMessagingWebhook } from "@/lib/server/telnyx/messaging-webhook";
import { readTelnyxWebhook, telnyxEventId } from "@/lib/server/telnyx/webhook-auth";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";

export async function GET() {
  return NextResponse.json({ ok: true, service: "telnyx-messaging-webhook" });
}

export async function POST(request: Request) {
  const read = await readTelnyxWebhook(request);
  if (!read.ok) return read.response;

  const eventId = telnyxEventId(read.payload);
  if (eventId) {
    const prisma = getPrisma();
    const existing = await prisma.providerWebhookEvent.findFirst({
      where: { provider: "telnyx", providerEventId: eventId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    await prisma.providerWebhookEvent
      .create({
        data: {
          provider: "telnyx",
          providerEventId: eventId,
          eventType: "messaging.inbound",
          payload: read.payload as object,
        },
      })
      .catch(() => undefined);
  }

  const result = await handleTelnyxMessagingWebhook(read.payload);
  void enqueueJob("phone_mctb_recovery_tick", {}).catch(() => undefined);

  return NextResponse.json(result);
}
