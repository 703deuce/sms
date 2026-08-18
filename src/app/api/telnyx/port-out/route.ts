import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { handleTelnyxPortOutWebhook } from "@/lib/numbers/telnyx-port-out-service";

function telnyxProviderEventId(body: {
  data?: { id?: string; event_type?: string; payload?: Record<string, unknown> };
}) {
  const eventType = body.data?.event_type || "unknown";
  const payload = body.data?.payload || {};
  const telnyxId = String(payload.id || body.data?.id || "");
  const status = String(payload.status || "");
  if (telnyxId) return `telnyx:port-out:${telnyxId}:${eventType}:${status}`;
  return `telnyx:port-out:${eventType}:${Date.now()}`;
}

/**
 * Telnyx port-out notification webhook (portout.status_changed, etc.)
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      data?: {
        id?: string;
        event_type?: string;
        payload?: Record<string, unknown>;
      };
    };
    const eventType = body.data?.event_type || "unknown";
    const payload = {
      ...(body.data?.payload || {}),
      event_type: eventType,
    } as Record<string, unknown>;

    const providerEventId = telnyxProviderEventId(body);
    const prisma = getPrisma();

    const existing = await prisma.providerWebhookEvent.findUnique({
      where: { providerEventId },
    });
    if (existing?.status === "processed") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    await prisma.providerWebhookEvent.upsert({
      where: { providerEventId },
      create: {
        provider: "telnyx",
        eventType,
        providerEventId,
        payload: body as object,
        status: "received",
      },
      update: { payload: body as object, eventType },
    });

    const result = await handleTelnyxPortOutWebhook(payload);

    await prisma.providerWebhookEvent.update({
      where: { providerEventId },
      data: {
        status: "processed",
        processedAt: new Date(),
        errorMessage: null,
      },
    });

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
