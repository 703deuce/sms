/**
 * Push a single Transovo platform event into one CRM provider.
 */

import { getPrisma } from "@/lib/db";
import { JobDeferredError } from "@/lib/messaging/types";
import { CrmHttpError } from "./http";
import { appendSyncEvent, writeCrmAudit } from "./logging";
import {
  fingerprintPhone,
  getObjectMapping,
  upsertObjectMapping,
} from "./mappings";
import { getConnector } from "./registry";
import { buildContext } from "./sync-engine";
import type { CrmPlatformEvent, CrmProviderId } from "./types";

export async function pushCrmEventJob(payload: {
  workspaceId: string;
  provider: CrmProviderId;
  event: CrmPlatformEvent;
}) {
  const { workspaceId, provider, event } = payload;
  const connector = getConnector(provider);
  const prisma = getPrisma();

  const run = await prisma.crmSyncRun.create({
    data: {
      workspaceId,
      provider,
      kind: "push",
      status: "running",
      startedAt: new Date(),
      triggeredBy: "system",
      statsJson: { eventType: event.type },
    },
  });

  try {
    const ctx = await buildContext(workspaceId, provider);
    const prefs = ctx.preferences;

    let contactExternalId: string | null = null;
    let contactPhone: string | null =
      (event.payload.from as string) || (event.payload.to as string) || null;

    if (event.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: event.contactId, workspaceId },
      });
      if (contact?.phone) contactPhone = contact.phone;

      if (contact && prefs.direction !== "inbound") {
        const { resolveContactForOutbound } = await import("./conflict");
        const resolved = await resolveContactForOutbound({
          workspaceId,
          provider,
          ctx,
          contactId: contact.id,
          phone: contact.phone,
          email: contact.email,
          syncRunId: run.id,
        });
        if (resolved.action === "skip") {
          await appendSyncEvent({
            workspaceId,
            syncRunId: run.id,
            provider,
            level: "warn",
            action: "skip",
            objectType: "contact",
            internalId: contact.id,
            message: resolved.reason,
          });
        } else if (resolved.action === "create_new") {
          const created = await connector.upsertContact(ctx, {
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone,
            email: contact.email,
            companyName: contact.company,
            source: "Transovo",
            ownerExternalId: prefs.defaultOwnerExternalId,
          });
          contactExternalId = created.externalId;
          await upsertObjectMapping({
            workspaceId,
            provider,
            objectType: "contact",
            internalId: contact.id,
            externalId: contactExternalId,
            fingerprint: fingerprintPhone(contact.phone),
          });
        } else {
          contactExternalId = resolved.externalId;
        }
      } else {
        const mapped = await getObjectMapping({
          workspaceId,
          provider,
          objectType: "contact",
          internalId: event.contactId,
        });
        contactExternalId = mapped?.externalId || null;
      }
    }

    // Communications (+ recording/transcript attach via call log update)
    if (
      (event.type.startsWith("call.") ||
        event.type === "voicemail.received" ||
        event.type === "recording.ready" ||
        event.type === "transcript.ready") &&
      prefs.syncCalls &&
      connector.logCall
    ) {
      const direction =
        event.type === "call.missed"
          ? "missed"
          : String(event.payload.direction || "inbound") === "outbound"
            ? "outbound"
            : "inbound";
      const result = await connector.logCall(ctx, {
        direction,
        from: (event.payload.from as string) || null,
        to: (event.payload.to as string) || null,
        durationSeconds:
          event.payload.durationSeconds != null ? Number(event.payload.durationSeconds) : null,
        disposition: (event.payload.disposition as string) || null,
        notes: (event.payload.notes as string) || null,
        recordingUrl: prefs.syncRecordings
          ? ((event.payload.recordingUrl as string) || null)
          : null,
        transcriptText: prefs.syncTranscripts
          ? ((event.payload.transcriptText as string) || null)
          : null,
        transcriptUrl: prefs.syncTranscripts
          ? ((event.payload.transcriptUrl as string) || null)
          : null,
        aiSummary: (event.payload.aiSummary as string) || null,
        contactExternalId,
        startedAt: event.occurredAt || new Date().toISOString(),
      });
      await appendSyncEvent({
        workspaceId,
        syncRunId: run.id,
        provider,
        action: "push",
        objectType: "call",
        externalId: result.externalId,
        message: `Logged ${event.type}`,
      });
    }

    if (event.type.startsWith("sms.") && prefs.syncSms && connector.logSms) {
      const result = await connector.logSms(ctx, {
        direction: event.type === "sms.received" ? "inbound" : "outbound",
        from: (event.payload.from as string) || null,
        to: (event.payload.to as string) || null,
        body: (event.payload.body as string) || null,
        status: (event.payload.status as string) || null,
        sentAt: event.occurredAt || new Date().toISOString(),
        contactExternalId,
      });
      await appendSyncEvent({
        workspaceId,
        syncRunId: run.id,
        provider,
        action: "push",
        objectType: "sms",
        externalId: result.externalId,
        message: `Logged ${event.type}`,
      });
    }

    // Task automation
    if (connector.createTask && prefs.syncTasks) {
      const taskSubject =
        event.type === "call.missed" && prefs.createTasksOnMissedCall
          ? `Follow up missed call${contactPhone ? ` (${contactPhone})` : ""}`
          : event.type === "callback.scheduled" && prefs.createTasksOnCallback
            ? `Requested callback${contactPhone ? ` (${contactPhone})` : ""}`
            : event.type === "voicemail.received" && prefs.createTasksOnVoicemail
              ? `Voicemail follow-up${contactPhone ? ` (${contactPhone})` : ""}`
              : null;
      if (taskSubject) {
        const due = new Date(Date.now() + 86400000).toISOString();
        const result = await connector.createTask(ctx, {
          subject: taskSubject,
          description: `Created automatically by Transovo from ${event.type}`,
          dueAt: due,
          status: "Not Started",
          contactExternalId,
          ownerExternalId: prefs.defaultOwnerExternalId,
        });
        await appendSyncEvent({
          workspaceId,
          syncRunId: run.id,
          provider,
          action: "create",
          objectType: "task",
          externalId: result.externalId,
          message: taskSubject,
        });
      }
    }

    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: { status: "succeeded", finishedAt: new Date() },
    });
    return { ok: true, syncRunId: run.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        lastError: message.slice(0, 500),
      },
    });
    await writeCrmAudit({
      workspaceId,
      provider,
      category: "push",
      action: "failed",
      message,
      detail: { eventType: event.type },
    });
    if (err instanceof CrmHttpError && err.retryable) {
      throw new JobDeferredError(`crm_push_retry:${message.slice(0, 80)}`, 60_000);
    }
    throw err;
  }
}
