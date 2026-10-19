import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import {
  handleInboundCall,
  processHumanCallWebhookEvent,
} from "@/lib/server/phone/calls-service";
import { processDueInboundRingTimeouts } from "@/lib/server/phone/inbound-runtime";
import { resolveWorkspaceForPhoneEvent } from "@/lib/server/phone/workspace-resolve";
import { readTelnyxWebhook, telnyxEventId, telnyxEventType } from "@/lib/server/telnyx/webhook-auth";

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

  const to =
    typeof eventPayload.to === "string"
      ? eventPayload.to
      : typeof eventPayload.called_number === "string"
        ? eventPayload.called_number
        : null;

  const workspaceId = await resolveWorkspaceForPhoneEvent(to);

  if (eventId) {
    const prisma = getPrisma();
    const exists = await prisma.telnyxWebhookDedup.findUnique({ where: { eventId } });
    if (exists) return NextResponse.json({ ok: true, deduped: true });
    await prisma.telnyxWebhookDedup.create({
      data: { eventId, eventType, workspaceId },
    });
  }

  await processDueInboundRingTimeouts(workspaceId).catch(() => undefined);

  if (eventType === "call.initiated" && eventPayload.direction === "incoming") {
    const from = String(eventPayload.from || "");
    const toNumber = String(eventPayload.to || to || "");
    await handleInboundCall({
      workspaceId,
      fromE164: from,
      toE164: toNumber,
      telnyxCallControlId: eventPayload.call_control_id
        ? String(eventPayload.call_control_id)
        : undefined,
    });
  }

  const result = await processHumanCallWebhookEvent({ eventType, eventPayload });
  return NextResponse.json({ ok: true, result });
}
