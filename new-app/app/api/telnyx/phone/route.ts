import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/server/db";
import {
  handleInboundCall,
  processHumanCallWebhookEvent,
} from "@/lib/server/phone/calls-service";
import { processDueInboundRingTimeouts } from "@/lib/server/phone/inbound-runtime";
import { resolveWorkspaceForPhoneEvent } from "@/lib/server/phone/workspace-resolve";
import { readTelnyxWebhook, telnyxEventId, telnyxEventType } from "@/lib/server/telnyx/webhook-auth";
import { decodeTelnyxClientState } from "@/lib/server/phone/telnyx-call-actions";
import { maskE164, phoneServerLog } from "@/lib/server/phone/phone-log";

export async function GET() {
  return NextResponse.json({ ok: true, service: "telnyx-phone-webhook" });
}

export async function POST(request: Request) {
  phoneServerLog("telnyx-webhook", "post_received", {
    path: "/api/telnyx/phone",
  });
  const read = await readTelnyxWebhook(request);
  if (!read.ok) {
    phoneServerLog("telnyx-webhook", "post_rejected_auth");
    return read.response;
  }

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

  const clientState = decodeTelnyxClientState(eventPayload.client_state);
  const workspaceId =
    typeof clientState.workspaceId === "string" && clientState.workspaceId.trim()
      ? clientState.workspaceId.trim()
      : await resolveWorkspaceForPhoneEvent(to);
  const direction = String(eventPayload.direction || "");
  const callControlId = eventPayload.call_control_id
    ? String(eventPayload.call_control_id)
    : null;

  phoneServerLog("telnyx-webhook", "event_parsed", {
    eventType,
    eventId: eventId || null,
    direction,
    to: maskE164(to),
    workspaceId,
    callControlId: callControlId ? `${callControlId.slice(0, 8)}…` : null,
  });

  if (eventId) {
    const prisma = getPrisma();
    const exists = await prisma.telnyxWebhookDedup.findUnique({ where: { eventId } });
    if (exists) {
      phoneServerLog("telnyx-webhook", "deduped", { eventId });
      return NextResponse.json({ ok: true, deduped: true });
    }
    await prisma.telnyxWebhookDedup.create({
      data: { eventId, eventType, workspaceId },
    });
    phoneServerLog("telnyx-webhook", "dedup_stored", { eventId, eventType });
  } else {
    phoneServerLog("telnyx-webhook", "no_event_id");
  }

  await processDueInboundRingTimeouts(workspaceId).catch((err) => {
    phoneServerLog("telnyx-webhook", "ring_timeout_processor_error", {
      error: err instanceof Error ? err.message : "unknown",
    });
  });

  if (eventType === "call.initiated" && eventPayload.direction === "incoming") {
    const from = String(eventPayload.from || "");
    const toNumber = String(eventPayload.to || to || "");
    phoneServerLog("telnyx-webhook", "inbound_initiated", {
      from: maskE164(from),
      to: maskE164(toNumber),
      workspaceId,
      callControlId: callControlId ? `${callControlId.slice(0, 8)}…` : null,
    });
    try {
      const call = await handleInboundCall({
        workspaceId,
        fromE164: from,
        toE164: toNumber,
        telnyxCallControlId: callControlId || undefined,
      });
      phoneServerLog("telnyx-webhook", "inbound_handled", {
        humanCallId: call.id,
        status: call.status,
        metadata: call.metadata,
      });
    } catch (err) {
      phoneServerLog("telnyx-webhook", "inbound_handler_error", {
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  let result: unknown = { ok: true };
  try {
    result = await processHumanCallWebhookEvent({ eventType, eventPayload });
  } catch (err) {
    phoneServerLog("telnyx-webhook", "event_processor_error", {
      eventType,
      error: err instanceof Error ? err.message : "unknown",
    });
    result = { ok: false, error: err instanceof Error ? err.message : "processor_error" };
  }
  phoneServerLog("telnyx-webhook", "event_processed", {
    eventType,
    resultOk: (result as { ok?: boolean }).ok ?? true,
  });
  return NextResponse.json({ ok: true, result });
}
