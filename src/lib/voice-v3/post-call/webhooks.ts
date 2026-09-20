import "server-only";

import { getPrisma } from "@/lib/db";
import type { VoiceV3StructuredSummary } from "./summary";
import type { VoiceV3PostCallSystemFacts } from "./system-facts";
import { mapSummaryOutcomeToWebhookType } from "../webhooks/events";
import { queueVoiceWebhookDelivery } from "../webhooks/delivery";

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

  const eventType = mapSummaryOutcomeToWebhookType(input.summary.outcome);
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
        headline: input.summary.headline,
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
