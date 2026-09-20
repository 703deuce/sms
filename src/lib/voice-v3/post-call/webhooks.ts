import "server-only";

import { createHmac } from "crypto";
import { getPrisma } from "@/lib/db";
import type { VoiceV3StructuredSummary } from "./summary";
import type { VoiceV3PostCallSystemFacts } from "./system-facts";

function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

function eventTypeForOutcome(outcome: string): string {
  switch (outcome) {
    case "APPOINTMENT_BOOKED":
      return "voice.appointment.booked";
    case "CALLBACK_REQUESTED":
      return "voice.callback.requested";
    case "TRANSFER_CONNECTED":
      return "voice.transfer.connected";
    case "TRANSFER_FAILED":
      return "voice.transfer.failed";
    case "EMERGENCY_ESCALATED":
      return "voice.emergency.escalated";
    default:
      return "voice.call.completed";
  }
}

export async function emitVoiceV3PostCallWebhooks(input: {
  callId: string;
  workspaceId: string;
  summary: VoiceV3StructuredSummary;
  facts: VoiceV3PostCallSystemFacts;
}): Promise<void> {
  const prisma = getPrisma();
  const hooks = await prisma.webhook.findMany({
    where: { workspaceId: input.workspaceId, active: true },
  });
  if (!hooks.length) return;

  const eventType = eventTypeForOutcome(input.summary.outcome);
  const eventId = `evt_${input.callId}_${eventType}`;
  const createdAt = new Date().toISOString();
  const payload = {
    id: eventId,
    type: eventType,
    createdAt,
    workspaceId: input.workspaceId,
    data: {
      callId: input.callId,
      caller: {
        phone: input.facts.callerE164,
        name: input.facts.callerName,
      },
      outcome: input.summary.outcome,
      startedAt: null,
      endedAt: null,
      durationSeconds: input.facts.durationSeconds,
      summary: {
        reasonForCall: input.summary.reasonForCall,
        actionRequired: input.summary.actionRequired,
      },
    },
  };
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));

  for (const hook of hooks) {
    if (!hook.events.includes(eventType) && !hook.events.includes("voice.call.completed")) continue;
    const secret = process.env.INTEGRATION_SECRET_KEY?.trim() || "transovo-webhook-dev";
    const signature = signBody(secret, timestamp, body);
    try {
      await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Transovo-Event-Id": eventId,
          "X-Transovo-Event-Type": eventType,
          "X-Transovo-Timestamp": timestamp,
          "X-Transovo-Signature": signature,
        },
        body,
      });
    } catch (err) {
      console.error("VOICE_V3_WEBHOOK_DELIVERY_FAILED", {
        hookId: hook.id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
