/**
 * Push a single Transovo platform event into one CRM provider.
 * Rate-limited per provider; actions resolved via the rules engine.
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
import { isFeatureSupported } from "./feature-matrix";
import { applyFieldMappingsOutbound, listFieldMappings } from "./mappings";
import { getConnector } from "./registry";
import {
  getMappedCallActivity,
  getMappedSmsActivity,
  persistMappedCallActivity,
  persistMappedSmsActivity,
} from "./call-lifecycle";
import { crmWriteIdempotencyKey, payloadSyncHash } from "./idempotency";
import {
  acquireCrmRateLimit,
  noteCrmRateLimitHit,
  noteCrmRateLimitSuccess,
} from "./runtime/rate-limit";
import { resolveRulesForEvent } from "./runtime/rules";
import { providerAcceptsEvent } from "./runtime/subscriptions";
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

  if (!providerAcceptsEvent(provider, event.type)) {
    return { ok: true, skipped: true, reason: "unsupported_event" };
  }

  // Gate writes early — paused / outbound-disabled / quarantined connections must not hit CRM APIs.
  {
    const { getCrmSyncPreferences } = await import("./settings");
    const { isCrmQuarantined } = await import("./circuit-breaker");
    const prefsEarly = await getCrmSyncPreferences(workspaceId, provider);
    if (prefsEarly.syncPaused) {
      return { ok: true, skipped: true, reason: "sync_paused" };
    }
    if (prefsEarly.disableWrites || prefsEarly.direction === "inbound") {
      return { ok: true, skipped: true, reason: "writes_disabled" };
    }
    if (await isCrmQuarantined(workspaceId, provider)) {
      return { ok: true, skipped: true, reason: "quarantined" };
    }
  }

  const rate = acquireCrmRateLimit(workspaceId, provider);
  if (!rate.ok) {
    throw new JobDeferredError(
      `crm_rate_limit:${rate.reason}`,
      Math.max(1_000, rate.retryAfterMs),
    );
  }

  const run = await prisma.crmSyncRun.create({
    data: {
      workspaceId,
      provider,
      kind: "push",
      status: "running",
      startedAt: new Date(),
      triggeredBy: "system",
      statsJson: { eventType: event.type, eventId: event.eventId },
    },
  });

  try {
    const { actions, rulesApplied } = await resolveRulesForEvent({
      workspaceId,
      provider,
      event,
    });
    if (!actions.length || (actions.length === 1 && actions[0] === "skip")) {
      await prisma.crmSyncRun.update({
        where: { id: run.id },
        data: {
          status: "succeeded",
          finishedAt: new Date(),
          statsJson: { eventType: event.type, skipped: true, rulesApplied },
        },
      });
      return { ok: true, skipped: true, syncRunId: run.id };
    }

    const ctx = await buildContext(workspaceId, provider);
    const prefs = ctx.preferences;
    const wantUpsert =
      actions.includes("upsert_contact") || actions.includes("create_lead");
    const wantCall =
      actions.includes("log_call") ||
      actions.includes("attach_recording") ||
      actions.includes("attach_transcript") ||
      actions.includes("attach_ai_summary");
    const wantSms = actions.includes("log_sms");
    const wantTask = actions.includes("create_task");
    const wantNote = actions.includes("create_note");

    let contactExternalId: string | null = null;
    let contactPhone: string | null =
      (event.payload.from as string) || (event.payload.to as string) || null;

    if (event.contactId) {
      const contact = await prisma.contact.findFirst({
        where: { id: event.contactId, workspaceId },
      });
      if (contact?.phone) contactPhone = contact.phone;

      if (contact && prefs.direction !== "inbound") {
        const existingMap = await getObjectMapping({
          workspaceId,
          provider,
          objectType: "contact",
          internalId: contact.id,
        });

        const tagRows = await prisma.contactTag
          .findMany({
            where: { contactId: contact.id },
            include: { tag: true },
          })
          .catch(
            () =>
              [] as Array<{
                tag: { name: string };
              }>,
          );
        const tagNames = tagRows
          .map((t: { tag: { name: string } }) => t.tag.name)
          .filter(Boolean);

        const fieldMaps = await listFieldMappings(workspaceId, provider);
        const mappedFields = applyFieldMappingsOutbound(
          {
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone,
            email: contact.email,
            company: contact.company,
            source: "Transovo",
            tags: tagNames.join(", "),
          },
          fieldMaps,
        );
        if (tagNames.length) {
          mappedFields.tags = tagNames;
          mappedFields.Tag = tagNames;
          // Pipedrive label_ids must be numeric IDs — resolved inside the adapter.
        }
        const hash = payloadSyncHash(mappedFields as Record<string, unknown>);

        if (existingMap?.externalId && !existingMap.externalDeletedAt) {
          // Enterprise path: always update the mapped CRM contact (never recreate).
          if (wantUpsert || event.type.startsWith("contact.") || event.type.startsWith("call.") || event.type.startsWith("sms.")) {
            if (existingMap.syncHash !== hash) {
              await connector.upsertContact(ctx, {
                id: existingMap.externalId,
                firstName: (mappedFields.firstName as string) || contact.firstName,
                lastName: (mappedFields.lastName as string) || contact.lastName,
                phone: (mappedFields.phone as string) || contact.phone,
                email: (mappedFields.email as string) || contact.email,
                companyName: (mappedFields.company as string) || contact.company,
                source: "Transovo",
                ownerExternalId: prefs.defaultOwnerExternalId,
                tags: tagNames,
                customFields: mappedFields,
              });
              await upsertObjectMapping({
                workspaceId,
                provider,
                objectType: "contact",
                internalId: contact.id,
                externalId: existingMap.externalId,
                fingerprint: fingerprintPhone(contact.phone),
                syncHash: hash,
                syncStatus: "synced",
                lastInternalModifiedAt: new Date(),
              });
            }
          }
          contactExternalId = existingMap.externalId;
        } else if (wantUpsert) {
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
              firstName: (mappedFields.firstName as string) || contact.firstName,
              lastName: (mappedFields.lastName as string) || contact.lastName,
              phone: (mappedFields.phone as string) || contact.phone,
              email: (mappedFields.email as string) || contact.email,
              companyName: (mappedFields.company as string) || contact.company,
              source: "Transovo",
              ownerExternalId: prefs.defaultOwnerExternalId,
              customFields: mappedFields,
            });
            contactExternalId = created.externalId;
            await upsertObjectMapping({
              workspaceId,
              provider,
              objectType: "contact",
              internalId: contact.id,
              externalId: contactExternalId,
              fingerprint: fingerprintPhone(contact.phone),
              syncHash: hash,
              syncStatus: "synced",
            });
          } else {
            // Matched existing CRM record — update it and persist mapping
            contactExternalId = resolved.externalId;
            await connector.upsertContact(ctx, {
              id: resolved.externalId,
              firstName: (mappedFields.firstName as string) || contact.firstName,
              lastName: (mappedFields.lastName as string) || contact.lastName,
              phone: (mappedFields.phone as string) || contact.phone,
              email: (mappedFields.email as string) || contact.email,
              companyName: (mappedFields.company as string) || contact.company,
              source: "Transovo",
              ownerExternalId: prefs.defaultOwnerExternalId,
              customFields: mappedFields,
            });
            await upsertObjectMapping({
              workspaceId,
              provider,
              objectType: "contact",
              internalId: contact.id,
              externalId: resolved.externalId,
              fingerprint: fingerprintPhone(contact.phone),
              syncHash: hash,
              syncStatus: "synced",
            });
          }
        } else {
          contactExternalId = existingMap?.externalId || null;
        }
      }
    }

    if (
      wantCall &&
      connector.logCall &&
      isFeatureSupported(provider, "calls")
    ) {
      const callId = String(event.payload.callId || event.eventId || "");
      const existingCall = await getMappedCallActivity({
        workspaceId,
        provider,
        callId: callId || null,
      });
      const direction =
        event.type === "call.missed"
          ? "missed"
          : String(event.payload.direction || "inbound") === "outbound"
            ? "outbound"
            : "inbound";
      const result = await connector.logCall(ctx, {
        id: existingCall?.externalId || undefined,
        direction,
        from: (event.payload.from as string) || null,
        to: (event.payload.to as string) || null,
        durationSeconds:
          event.payload.durationSeconds != null ? Number(event.payload.durationSeconds) : null,
        disposition: (event.payload.disposition as string) || null,
        notes: (event.payload.notes as string) || null,
        recordingUrl: actions.includes("attach_recording") || prefs.syncRecordings
          ? ((event.payload.recordingUrl as string) || null)
          : null,
        transcriptText: actions.includes("attach_transcript") || prefs.syncTranscripts
          ? ((event.payload.transcriptText as string) || null)
          : null,
        transcriptUrl: actions.includes("attach_transcript") || prefs.syncTranscripts
          ? ((event.payload.transcriptUrl as string) || null)
          : null,
        aiSummary: actions.includes("attach_ai_summary") || prefs.syncAiSummary
          ? ((event.payload.aiSummary as string) || null)
          : null,
        contactExternalId,
        startedAt: event.occurredAt || new Date().toISOString(),
      });
      if (callId) {
        await persistMappedCallActivity({
          workspaceId,
          provider,
          callId,
          externalId: result.externalId,
          contactExternalId,
        });
      }
      await appendSyncEvent({
        workspaceId,
        syncRunId: run.id,
        provider,
        action: result.created ? "create" : "update",
        objectType: "call",
        externalId: result.externalId,
        internalId: callId || null,
        message: `${result.created ? "Created" : "Updated"} call activity for ${event.type}`,
      });
    }

    if (wantSms && connector.logSms && isFeatureSupported(provider, "sms")) {
      const messageId = String(event.payload.messageId || event.eventId || "");
      const existingSms = await getMappedSmsActivity({
        workspaceId,
        provider,
        messageId: messageId || null,
      });
      const mediaUrls =
        prefs.syncMms === false
          ? undefined
          : Array.isArray(event.payload.mediaUrls)
            ? (event.payload.mediaUrls as string[])
            : event.payload.mediaUrl
              ? [String(event.payload.mediaUrl)]
              : undefined;
      const result = await connector.logSms(ctx, {
        id: existingSms?.externalId || undefined,
        direction: event.type === "sms.received" ? "inbound" : "outbound",
        from: (event.payload.from as string) || null,
        to: (event.payload.to as string) || null,
        body: (event.payload.body as string) || null,
        mediaUrls,
        status: (event.payload.status as string) || null,
        sentAt: event.occurredAt || new Date().toISOString(),
        contactExternalId,
      });
      if (messageId) {
        await persistMappedSmsActivity({
          workspaceId,
          provider,
          messageId,
          externalId: result.externalId,
          contactExternalId,
        });
      }
      await appendSyncEvent({
        workspaceId,
        syncRunId: run.id,
        provider,
        action: result.created ? "create" : "update",
        objectType: "sms",
        externalId: result.externalId,
        internalId: messageId || null,
        message: `${result.created ? "Created" : "Updated"} SMS activity for ${event.type}`,
      });
    }

    if (
      wantNote &&
      prefs.syncNotes &&
      connector.createNote &&
      isFeatureSupported(provider, "notes")
    ) {
      const noteInternalId = String(
        event.payload.noteId || event.eventId || `${event.type}:note:${contactPhone || "na"}`,
      );
      const existingNote = await getObjectMapping({
        workspaceId,
        provider,
        objectType: "note",
        internalId: noteInternalId,
      });
      const noteBody =
        event.type === "appointment.booked"
          ? [
              event.payload.subject || "Appointment booked",
              event.payload.startsAt ? `Starts: ${String(event.payload.startsAt)}` : null,
              event.payload.endsAt ? `Ends: ${String(event.payload.endsAt)}` : null,
              event.payload.timezone ? `Timezone: ${String(event.payload.timezone)}` : null,
              event.payload.serviceName ? `Service: ${String(event.payload.serviceName)}` : null,
            ]
              .filter(Boolean)
              .join("\n")
          : event.type === "appointment.cancelled"
            ? [
                event.payload.subject || "Appointment cancelled",
                event.payload.startsAt ? `Was scheduled: ${String(event.payload.startsAt)}` : null,
                event.payload.reason ? `Reason: ${String(event.payload.reason)}` : null,
                event.payload.notes ? String(event.payload.notes) : null,
              ]
                .filter(Boolean)
                .join("\n")
          : (event.payload.notes as string) ||
            (event.payload.body as string) ||
            `Transovo ${event.type}${contactPhone ? ` (${contactPhone})` : ""}`;
      let result;
      if (existingNote?.externalId && connector.updateNote) {
        result = await connector.updateNote(ctx, {
          id: existingNote.externalId,
          body: noteBody,
          contactExternalId,
        });
      } else {
        result = await connector.createNote(ctx, {
          body: noteBody,
          contactExternalId,
        });
      }
      await upsertObjectMapping({
        workspaceId,
        provider,
        objectType: "note",
        internalId: noteInternalId,
        externalId: result.externalId,
        parentExternalId: contactExternalId,
        syncStatus: "synced",
      });
      await appendSyncEvent({
        workspaceId,
        syncRunId: run.id,
        provider,
        action: result.created ? "create" : "update",
        objectType: "note",
        externalId: result.externalId,
        internalId: noteInternalId,
        message: `Note from ${event.type}`,
      });
    }

    if (wantTask && connector.createTask && isFeatureSupported(provider, "tasks")) {
      const taskSubject =
        event.type === "call.missed"
          ? `Follow up missed call${contactPhone ? ` (${contactPhone})` : ""}`
          : event.type === "callback.scheduled"
            ? `Requested callback${contactPhone ? ` (${contactPhone})` : ""}`
            : event.type === "voicemail.received"
              ? `Voicemail follow-up${contactPhone ? ` (${contactPhone})` : ""}`
              : event.type === "appointment.booked"
                ? String(event.payload.subject || "Appointment follow-up")
                : event.type === "appointment.cancelled"
                  ? `Cancelled: ${String(event.payload.serviceName || event.payload.subject || "Appointment")}`
                : event.type === "task.completed"
                  ? `Completed: ${String(event.payload.subject || "Task")}`
                  : event.type.startsWith("task.")
                    ? String(event.payload.subject || "Transovo task")
                    : null;
      if (taskSubject) {
        const taskInternalId = String(
          event.payload.taskId ||
            event.eventId ||
            crmWriteIdempotencyKey({
              workspaceId,
              provider,
              action: "create_task",
              objectType: "task",
              internalId: `${event.type}:${contactPhone || "na"}`,
            }),
        );
        const existingTask = await getObjectMapping({
          workspaceId,
          provider,
          objectType: "task",
          internalId: taskInternalId,
        });
        const due = new Date(Date.now() + 86400000).toISOString();
        const status =
          event.type === "task.completed" || event.type === "appointment.cancelled"
            ? "Completed"
            : "Not Started";
        let result;
        if (existingTask?.externalId && connector.updateTask) {
          result = await connector.updateTask(ctx, {
            id: existingTask.externalId,
            subject: taskSubject,
            description: `Updated automatically by Transovo from ${event.type}`,
            dueAt: due,
            status,
            contactExternalId,
            ownerExternalId: prefs.defaultOwnerExternalId,
          });
        } else {
          result = await connector.createTask(ctx, {
            subject: taskSubject,
            description: `Created automatically by Transovo from ${event.type}`,
            dueAt: due,
            status,
            contactExternalId,
            ownerExternalId: prefs.defaultOwnerExternalId,
          });
        }
        await upsertObjectMapping({
          workspaceId,
          provider,
          objectType: "task",
          internalId: taskInternalId,
          externalId: result.externalId,
          parentExternalId: contactExternalId,
          syncStatus: "synced",
        });
        await appendSyncEvent({
          workspaceId,
          syncRunId: run.id,
          provider,
          action: result.created ? "create" : "update",
          objectType: "task",
          externalId: result.externalId,
          internalId: taskInternalId,
          message: taskSubject,
        });
      }
    }

    if (
      actions.includes("create_lead") &&
      connector.upsertLead &&
      isFeatureSupported(provider, "leads") &&
      !(provider === "zoho" && prefs.zohoProduct === "bigin")
    ) {
      const leadInternalId = String(event.payload.leadId || event.contactId || event.eventId);
      const existingLead = await getObjectMapping({
        workspaceId,
        provider,
        objectType: "lead",
        internalId: leadInternalId,
      });
      const created = await connector.upsertLead(ctx, {
        id: existingLead?.externalId || undefined,
        firstName: (event.payload.firstName as string) || null,
        lastName: (event.payload.lastName as string) || "Lead",
        phone: contactPhone,
        email: (event.payload.email as string) || null,
        source: "Transovo",
        companyName: (event.payload.company as string) || null,
        ownerExternalId: prefs.defaultOwnerExternalId,
        status: (event.payload.status as string) || null,
      });
      await upsertObjectMapping({
        workspaceId,
        provider,
        objectType: "lead",
        internalId: leadInternalId,
        externalId: created.externalId,
        syncStatus: "synced",
      });
      await appendSyncEvent({
        workspaceId,
        syncRunId: run.id,
        provider,
        action: created.created ? "create" : "update",
        objectType: "lead",
        externalId: created.externalId,
        internalId: leadInternalId,
        message: `Lead from ${event.type}`,
      });
    }

    // Company upsert when contact has company and auto-create companies is on.
    if (
      contactExternalId &&
      connector.upsertCompany &&
      prefs.autoCreateCompanies &&
      isFeatureSupported(provider, "companies") &&
      event.contactId
    ) {
      const contact = await prisma.contact.findFirst({
        where: { id: event.contactId, workspaceId },
      });
      if (contact?.company) {
        const companyInternalId = `contact-company:${contact.id}`;
        const existingCompany = await getObjectMapping({
          workspaceId,
          provider,
          objectType: "company",
          internalId: companyInternalId,
        });
        const companyResult = await connector.upsertCompany(ctx, {
          id: existingCompany?.externalId || undefined,
          name: contact.company,
          phone: contact.phone,
          ownerExternalId: prefs.defaultOwnerExternalId,
        });
        await upsertObjectMapping({
          workspaceId,
          provider,
          objectType: "company",
          internalId: companyInternalId,
          externalId: companyResult.externalId,
          syncStatus: "synced",
        });
        // Link the CRM person/contact to the organization/account (idempotent update).
        if (contactExternalId && companyResult.externalId) {
          await connector.upsertContact(ctx, {
            id: contactExternalId,
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone,
            email: contact.email,
            companyName: contact.company,
            companyExternalId: companyResult.externalId,
            ownerExternalId: prefs.defaultOwnerExternalId,
            source: "Transovo",
          });
        }
      }
    }

    // Deal/opportunity writes when enabled and payload carries deal fields.
    if (
      prefs.syncOpportunities &&
      connector.upsertDeal &&
      isFeatureSupported(provider, "deals") &&
      (event.payload.dealName || event.payload.opportunityName)
    ) {
      const dealInternalId = String(
        event.payload.dealId || event.payload.opportunityId || `${event.eventId}:deal`,
      );
      const existingDeal = await getObjectMapping({
        workspaceId,
        provider,
        objectType: "deal",
        internalId: dealInternalId,
      });
      const dealResult = await connector.upsertDeal(ctx, {
        id: existingDeal?.externalId || undefined,
        name: String(event.payload.dealName || event.payload.opportunityName),
        amount: event.payload.amount != null ? Number(event.payload.amount) : null,
        currency: (event.payload.currency as string) || null,
        stage: (event.payload.stage as string) || prefs.defaultStageId || null,
        pipeline: (event.payload.pipeline as string) || prefs.defaultPipelineId || null,
        contactExternalId,
        status: (event.payload.dealStatus as string) || null,
        ownerExternalId: prefs.defaultOwnerExternalId,
      });
      await upsertObjectMapping({
        workspaceId,
        provider,
        objectType: "deal",
        internalId: dealInternalId,
        externalId: dealResult.externalId,
        parentExternalId: contactExternalId,
        syncStatus: "synced",
      });
      await appendSyncEvent({
        workspaceId,
        syncRunId: run.id,
        provider,
        action: dealResult.created ? "create" : "update",
        objectType: "deal",
        externalId: dealResult.externalId,
        internalId: dealInternalId,
        message: `Deal from ${event.type}`,
      });
    }

    await noteCrmRateLimitSuccess(workspaceId, provider);
    await prisma.crmSyncRun.update({
      where: { id: run.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        statsJson: { eventType: event.type, rulesApplied, actions },
      },
    });
    return { ok: true, syncRunId: run.id, rulesApplied };
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
    if (err instanceof CrmHttpError && err.status === 429) {
      const hit = await noteCrmRateLimitHit(workspaceId, provider);
      throw new JobDeferredError(`crm_push_429:${message.slice(0, 60)}`, hit.retryAfterMs);
    }
    if (err instanceof CrmHttpError && err.retryable) {
      throw new JobDeferredError(`crm_push_retry:${message.slice(0, 80)}`, 60_000);
    }
    throw err;
  }
}
