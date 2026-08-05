/**
 * TeXML application status_callback handler.
 *
 * TeXML apps do not use Call Control `webhook_event_url`. Call progress
 * arrives as Twilio-style form posts (or occasionally JSON) on
 * `status_callback`. Without this path, TeXML-direct inbound never creates
 * VoiceCall / enrolls workflows / runs post-call resume.
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getTelnyxApiKey, getTelnyxPublicKey } from "@/lib/messaging/telnyx/config";
import { telnyxProvider } from "@/lib/messaging/telnyx/provider";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

function formToRecord(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(raw);
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}

function pick(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/** Map TeXML / Twilio-style CallStatus → internal event type. */
export function mapTexmlCallStatus(status: string): string {
  const s = status.trim().toLowerCase().replace(/_/g, "-");
  switch (s) {
    case "initiated":
      return "call.initiated";
    case "ringing":
      return "call.ringing";
    case "answered":
    case "in-progress":
    case "inprogress":
      return "call.answered";
    case "completed":
      return "call.hangup";
    case "busy":
      return "call.hangup";
    case "no-answer":
    case "noanswer":
      return "call.hangup";
    case "canceled":
    case "cancelled":
      return "call.hangup";
    case "failed":
      return "call.hangup";
    default:
      return s.includes(".") ? s : `call.${s || "unknown"}`;
  }
}

function hangupStatusFromTexml(status: string): string {
  const s = status.trim().toLowerCase().replace(/_/g, "-");
  if (s === "busy") return "BUSY";
  if (s === "no-answer" || s === "noanswer") return "NO_ANSWER";
  if (s === "canceled" || s === "cancelled") return "CANCELLED";
  if (s === "failed") return "FAILED";
  return "COMPLETED";
}

export async function handleTexmlStatusCallback(request: Request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  const rawBody = await request.text();

  const signature =
    request.headers.get("telnyx-signature-ed25519") ||
    request.headers.get("x-telnyx-signature") ||
    request.headers.get("telnyx-signature");
  const timestamp =
    request.headers.get("telnyx-timestamp") ||
    request.headers.get("x-telnyx-timestamp");

  const mustVerify = Boolean(getTelnyxPublicKey() || getTelnyxApiKey());
  if (signature || timestamp) {
    const verified = await telnyxProvider.verifyWebhook({
      payload: rawBody,
      signature,
      timestamp,
      headers: request.headers,
    });
    if (!verified && mustVerify) {
      return new NextResponse("Invalid signature", { status: 403 });
    }
  }
  // TeXML status_callback is often unsigned form POST. Accept form bodies;
  // JSON without signature still fails closed when credentials are configured.
  const isForm =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data") ||
    (!contentType.includes("json") && rawBody.includes("CallStatus="));

  let eventType = "";
  let eventPayload: Record<string, unknown> = {};
  let providerEventId = "";

  if (isForm || (!rawBody.trim().startsWith("{") && rawBody.includes("="))) {
    const fields = formToRecord(rawBody);
    const callStatus = pick(fields.CallStatus, fields.CallStatusEvent, fields.Status);
    eventType = mapTexmlCallStatus(callStatus || "unknown");
    const callSid = pick(fields.CallSid, fields.CallSidLegacy, fields.call_sid);
    const from = pick(fields.From, fields.Caller, fields.from);
    const to = pick(fields.To, fields.Called, fields.to);
    eventPayload = {
      ...fields,
      call_control_id: callSid || undefined,
      call_session_id: pick(fields.CallSessionId, fields.call_session_id) || undefined,
      from,
      to,
      direction: pick(fields.Direction, fields.direction) || "incoming",
      hangup_cause: callStatus,
      texml_call_status: callStatus,
      call_duration: pick(fields.CallDuration, fields.Duration),
      source: "texml_status_callback",
    };
    providerEventId = [
      pick(fields.CallSid, fields.SmsSid) || "nosid",
      callStatus || "event",
      pick(fields.Timestamp, fields.SequenceNumber) || String(Date.now()),
    ].join(":");
  } else {
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Invalid body", { status: 400 });
    }
    if (!signature && mustVerify) {
      return new NextResponse("Invalid signature", { status: 403 });
    }
    const root = (payload || {}) as Record<string, unknown>;
    const data = (root.data || root) as Record<string, unknown>;
    eventType = String(
      data.event_type || root.event_type || "call.unknown",
    ).toLowerCase();
    eventPayload = (data.payload || data || {}) as Record<string, unknown>;
    providerEventId = String(
      data.id || root.id || `texml-json:${Date.now()}`,
    );
  }

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
      eventType: `texml.${eventType}`,
      providerEventId,
      payload: { eventType, eventPayload } as object,
      status: "received",
    },
    update: {
      payload: { eventType, eventPayload } as object,
    },
  });

  // Ensure VoiceCall + workflow enrollment as early as initiated/answered.
  const { ensureVoiceCallForTelnyxEvent } = await import(
    "@/lib/voice/ensure-call-from-event"
  );
  const ensured = await ensureVoiceCallForTelnyxEvent({
    eventType,
    eventPayload,
  }).catch((err) => {
    console.error("[texml-status] ensureVoiceCall", err);
    return null;
  });

  let callId = ensured?.callId || null;
  if (!callId) {
    const controlId = pick(
      eventPayload.call_control_id,
      eventPayload.CallSid,
    );
    if (controlId) {
      const found = await prisma.voiceCall.findFirst({
        where: { telnyxCallControlId: controlId },
        select: { id: true },
      });
      callId = found?.id || null;
    }
  }

  if (callId) {
    const texmlStatus = String(eventPayload.texml_call_status || "");
    const terminalForm = [
      "completed",
      "busy",
      "no-answer",
      "noanswer",
      "canceled",
      "cancelled",
      "failed",
    ].includes(texmlStatus.toLowerCase().replace(/_/g, "-"));
    const terminalEvent =
      eventType === "call.hangup" ||
      eventType.includes("ended") ||
      terminalForm;

    if (terminalEvent) {
      const durationRaw = pick(eventPayload.call_duration, eventPayload.CallDuration);
      const durationSeconds = durationRaw ? Number(durationRaw) || null : null;
      await prisma.voiceCall.update({
        where: { id: callId },
        data: {
          endedAt: new Date(),
          status: hangupStatusFromTexml(texmlStatus || "completed"),
          ...(durationSeconds != null ? { durationSeconds } : {}),
        },
      });
      if (
        hangupStatusFromTexml(texmlStatus || "completed") === "COMPLETED" &&
        durationSeconds &&
        durationSeconds > 0
      ) {
        const row = await prisma.voiceCall.findUnique({
          where: { id: callId },
          select: { answeredAt: true },
        });
        if (!row?.answeredAt) {
          await prisma.voiceCall.update({
            where: { id: callId },
            data: { answeredAt: new Date(Date.now() - durationSeconds * 1000) },
          });
        }
      }

      const call = await prisma.voiceCall.findUnique({
        where: { id: callId },
        select: { workspaceId: true },
      });
      if (call) {
        await enqueueJob({
          jobType: "voice_post_call",
          queueName: "voice-calls",
          payload: { callId, workspaceId: call.workspaceId },
          idempotencyKey: `voice-post-call:${callId}`,
        }).catch(() => undefined);
      }
    } else if (eventType === "call.answered") {
      await prisma.voiceCall
        .update({
          where: { id: callId },
          data: {
            status: "IN_PROGRESS",
            answeredAt: new Date(),
          },
        })
        .catch(() => undefined);
    } else if (eventType === "call.initiated" || eventType === "call.ringing") {
      await prisma.voiceCall
        .update({
          where: { id: callId },
          data: { status: "RINGING" },
        })
        .catch(() => undefined);
    }
  } else {
    // Last resort: resolve by To/From without call_control_id.
    const to = normalizeE164(pick(eventPayload.to, eventPayload.To)) || "";
    const from = normalizeE164(pick(eventPayload.from, eventPayload.From)) || "";
    if (to && from) {
      const pn = await prisma.phoneNumber.findFirst({
        where: { e164: to },
        select: { id: true, workspaceId: true },
      });
      if (pn) {
        const ensured2 = await ensureVoiceCallForTelnyxEvent({
          eventType: eventType || "call.initiated",
          eventPayload: {
            ...eventPayload,
            to,
            from,
            call_control_id:
              pick(eventPayload.call_control_id) ||
              `texml:${to}:${from}:${providerEventId}`.slice(0, 120),
          },
        }).catch(() => null);
        callId = ensured2?.callId || null;
      }
    }
  }

  await prisma.providerWebhookEvent.update({
    where: { providerEventId },
    data: {
      status: "processed",
      processedAt: new Date(),
      workspaceId: callId
        ? (
            await prisma.voiceCall.findUnique({
              where: { id: callId },
              select: { workspaceId: true },
            })
          )?.workspaceId
        : undefined,
    },
  });

  return NextResponse.json({
    ok: true,
    eventType,
    callId,
    providerEventId,
  });
}
