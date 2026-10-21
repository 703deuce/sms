import "server-only";

import { getPrisma } from "@/lib/server/db";
import { loadDeterministicCallFacts } from "../call-history/call-facts";
import { deriveVoiceV3PostCallOutcome } from "./derive-call-outcome";
import { mapSummaryOutcomeToWebhookType } from "../webhooks/events";
import { queueVoiceWebhookDelivery } from "../webhooks/delivery";

export async function emitVoiceV3PostCallWebhooks(input: {
  callId: string;
  workspaceId: string;
  summaryText: string;
}): Promise<void> {
  const prisma = getPrisma();
  const hooks = await prisma.webhook.findMany({
    where: { workspaceId: input.workspaceId, active: true },
  });
  if (!hooks.length) return;

  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: {
      fromE164: true,
      durationSeconds: true,
      outcome: true,
      startedAt: true,
      endedAt: true,
    },
  });
  if (!call) return;

  const facts = await loadDeterministicCallFacts(input.callId, input.workspaceId);
  const outcome = deriveVoiceV3PostCallOutcome(facts, call.outcome);
  const eventType = mapSummaryOutcomeToWebhookType(outcome);
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
        phone: facts.callerPhone || call.fromE164,
        name: facts.callerName,
      },
      outcome,
      startedAt: call.startedAt?.toISOString() ?? null,
      endedAt: call.endedAt?.toISOString() ?? null,
      durationSeconds: call.durationSeconds,
      summary: {
        reasonForCall: null,
        actionRequired: outcome === "CALLBACK_REQUESTED" || outcome === "TRANSFER_FAILED",
        headline: input.summaryText.slice(0, 200),
      },
    },
  };

  for (const hook of hooks) {
    const subscribed =
      hook.events.includes(eventType) ||
      hook.events.includes("voice.call.completed") ||
      hook.events.includes("*");
    if (!subscribed) continue;
    await queueVoiceWebhookDelivery({
      workspaceId: input.workspaceId,
      webhookId: hook.id,
      eventId: `${eventId}:${hook.id}`,
      eventType,
      payload,
    });
  }
}
