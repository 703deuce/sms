import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import {
  handleInboundCall,
  processHumanCallWebhookEvent,
} from "@/lib/server/phone/calls-service";
import { readTelnyxWebhook, telnyxEventId, telnyxEventType } from "@/lib/server/telnyx/webhook-auth";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET() {
  return NextResponse.json({ ok: true, service: "telnyx-phone-webhook" });
}

export async function POST(request: Request) {
  const read = await readTelnyxWebhook(request);
  if (!read.ok) return read.response;

  const eventType = telnyxEventType(read.payload);
  const eventId = telnyxEventId(read.payload);
  const payload = read.payload as Record<string, unknown>;
  const data = (payload.data || {}) as Record<string, unknown>;
  const eventPayload = (data.payload || {}) as Record<string, unknown>;

  if (eventId) {
    const prisma = getPrisma();
    const exists = await prisma.telnyxWebhookDedup.findUnique({ where: { eventId } });
    if (exists) return NextResponse.json({ ok: true, deduped: true });
    await prisma.telnyxWebhookDedup.create({
      data: { eventId, eventType, workspaceId: await resolveWorkspaceId().catch(() => null) },
    });
  }

  if (eventType === "call.initiated" && eventPayload.direction === "incoming") {
    const workspaceId = await resolveWorkspaceId();
    const from = String(eventPayload.from || "");
    const to = String(eventPayload.to || "");
    await handleInboundCall({
      workspaceId,
      fromE164: from,
      toE164: to,
      telnyxCallControlId: eventPayload.call_control_id
        ? String(eventPayload.call_control_id)
        : undefined,
    });
  }

  const result = await processHumanCallWebhookEvent({ eventType, eventPayload });
  return NextResponse.json({ ok: true, result });
}
