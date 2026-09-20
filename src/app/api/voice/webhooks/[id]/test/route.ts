import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { queueVoiceWebhookDelivery } from "@/lib/voice-v3/webhooks/delivery";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const prisma = getPrisma();
    const hook = await prisma.webhook.findFirst({
      where: { id, workspaceId: auth.workspaceId, active: true },
    });
    if (!hook) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const eventId = `evt_test_${id}_${Date.now()}`;
    await queueVoiceWebhookDelivery({
      workspaceId: auth.workspaceId,
      webhookId: hook.id,
      eventId,
      eventType: "voice.test",
      payload: {
        id: eventId,
        type: "voice.test",
        createdAt: new Date().toISOString(),
        workspaceId: auth.workspaceId,
        test: true,
        data: { message: "Transovo voice webhook test event" },
      },
    });
    return NextResponse.json({ ok: true, eventId });
  } catch (err) {
    return jsonError(err, 500);
  }
}
