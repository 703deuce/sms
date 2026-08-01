/**
 * Publish Transovo platform events to connected CRM adapters (async).
 */

import { getPrisma } from "@/lib/db";
import type { InputJsonValue } from "@/lib/domain";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { CRM_PROVIDER_IDS } from "./registry";
import type { CrmPlatformEvent, CrmPlatformEventType, CrmProviderId } from "./types";
import { writeCrmAudit } from "./logging";

export async function publishCrmEvent(event: CrmPlatformEvent) {
  const connected = await getPrisma().integrationConnection.findMany({
    where: {
      workspaceId: event.workspaceId,
      provider: { in: [...CRM_PROVIDER_IDS] },
      status: { in: ["connected", "syncing"] },
    },
    select: { provider: true },
  });

  if (!connected.length) return { enqueued: 0 };

  let enqueued = 0;
  for (const row of connected) {
    const provider = row.provider as CrmProviderId;
    try {
      const jobPayload = JSON.parse(
        JSON.stringify({
          workspaceId: event.workspaceId,
          provider,
          event: {
            type: event.type,
            workspaceId: event.workspaceId,
            contactId: event.contactId ?? null,
            occurredAt: event.occurredAt,
            payload: event.payload,
          },
        }),
      ) as InputJsonValue;
      await enqueueJob({
        jobType: "crm_push_event",
        queueName: "integrations",
        workspaceId: event.workspaceId,
        payload: jobPayload,
        idempotencyKey: `crm-push-${provider}-${event.type}-${event.contactId || "na"}-${event.occurredAt || Date.now()}`.slice(
          0,
          180,
        ),
      });
      enqueued += 1;
    } catch (err) {
      console.warn("[crm] enqueue push failed", provider, err);
    }
  }

  if (enqueued) {
    await writeCrmAudit({
      workspaceId: event.workspaceId,
      category: "push",
      action: event.type,
      message: `Published ${event.type} to ${enqueued} CRM connector(s)`,
      detail: {
        contactId: event.contactId,
        providers: connected.map((c: { provider: string }) => c.provider),
      },
    });
  }

  return { enqueued };
}

/** Convenience helpers used by phone/SMS call sites. */
export async function publishCallCompleted(input: {
  workspaceId: string;
  contactId?: string | null;
  callId: string;
  direction: "inbound" | "outbound" | "missed";
  from?: string | null;
  to?: string | null;
  durationSeconds?: number | null;
  disposition?: string | null;
  recordingUrl?: string | null;
  notes?: string | null;
}) {
  const type: CrmPlatformEventType =
    input.direction === "missed" ? "call.missed" : "call.completed";
  return publishCrmEvent({
    type,
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    occurredAt: new Date().toISOString(),
    payload: { ...input },
  });
}

export async function publishSmsEvent(input: {
  workspaceId: string;
  contactId?: string | null;
  direction: "inbound" | "outbound";
  from?: string | null;
  to?: string | null;
  body?: string | null;
  status?: string | null;
  messageId?: string | null;
}) {
  return publishCrmEvent({
    type: input.direction === "inbound" ? "sms.received" : "sms.sent",
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    occurredAt: new Date().toISOString(),
    payload: { ...input },
  });
}

export async function publishRecordingReady(input: {
  workspaceId: string;
  contactId?: string | null;
  callId: string;
  recordingUrl: string;
  direction?: "inbound" | "outbound" | "missed";
}) {
  return publishCrmEvent({
    type: "recording.ready",
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    occurredAt: new Date().toISOString(),
    payload: { ...input },
  });
}

export async function publishTranscriptReady(input: {
  workspaceId: string;
  contactId?: string | null;
  callId: string;
  transcriptUrl?: string | null;
  transcriptText?: string | null;
  aiSummary?: string | null;
}) {
  return publishCrmEvent({
    type: "transcript.ready",
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    occurredAt: new Date().toISOString(),
    payload: { ...input },
  });
}

export async function publishVoicemailReceived(input: {
  workspaceId: string;
  contactId?: string | null;
  callId?: string | null;
  from?: string | null;
  to?: string | null;
  recordingUrl?: string | null;
}) {
  return publishCrmEvent({
    type: "voicemail.received",
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    occurredAt: new Date().toISOString(),
    payload: { ...input, direction: "missed" },
  });
}

export async function publishCallbackScheduled(input: {
  workspaceId: string;
  contactId?: string | null;
  callId?: string | null;
  phone?: string | null;
}) {
  return publishCrmEvent({
    type: "callback.scheduled",
    workspaceId: input.workspaceId,
    contactId: input.contactId,
    occurredAt: new Date().toISOString(),
    payload: { ...input },
  });
}
