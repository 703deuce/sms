import "server-only";

import {
  enrichContactWithOutlookGraphPhone,
  resolveContactForImportedEvent,
} from "@/lib/calendar/attendee-contact";
import { mergeCalendarConnectionConfig } from "@/lib/calendar/connection-config-merge";
import {
  getWorkspaceCalendarConnection,
  updateWorkspaceCalendarConnection,
} from "@/lib/calendar/connections";
import {
  isEventEligibleForCalendarMirror,
  isEventEligibleForReminderImport,
  shouldImportFromConnection,
} from "@/lib/calendar/eligibility";
import { resolveImportRulesForCalendar } from "@/lib/calendar/import-rules";
import { enrichImportMetadataWithRecipientSuppression } from "@/lib/appointment-reminders/ar-recipient-suppression";
import {
  formatImportedExternalId,
  isTransovoBookedExternalId,
  isTransovoOriginatedAppointment,
  parseImportedExternalId,
} from "@/lib/calendar/external-id";
import {
  getGoogleCalendarEvent,
  getMicrosoftCalendarEvent,
  getValidAccessToken,
  listGoogleCalendarEvents,
  listMicrosoftCalendarEventsForAppointmentDiscovery,
  resolveImportCalendarIds,
  type CalendarConfig,
  type ProviderCalendarEvent,
} from "@/lib/calendar/providers";
import {
  commitMicrosoftDeltaCheckpoint,
  syncMicrosoftCalendarDelta,
} from "@/lib/calendar/microsoft-delta-sync";
import {
  markMicrosoftSyncFailure,
  markMicrosoftSyncSuccess,
} from "@/lib/calendar/microsoft-connection-schedule";
import {
  resolveMicrosoftCalendarViewSyncWindow,
  shouldAdvanceMicrosoftDeltaWindow,
} from "@/lib/calendar/microsoft-sync-window";
import { ensureMicrosoftCalendarSubscription } from "@/lib/calendar/webhooks";
import {
  findWorkspaceAppointmentByExternalId,
  upsertWorkspaceAppointmentByExternalId,
} from "@/lib/appointments/domain";
import { getPrisma } from "@/lib/db";
import { mergeReminderPhoneOnImport } from "@/lib/appointment-reminders/calendar/reminder-phone-extraction";
import type { AppointmentMetadata } from "@/lib/appointments/types";

export type CalendarSyncStats = {
  imported: number;
  updated: number;
  canceled: number;
  skipped: number;
  errors: number;
};

export type ProcessEventResult = "imported" | "updated" | "canceled" | "skipped" | "error";

function defaultSyncWindow(config: CalendarConfig, incremental: boolean, lastSyncAt?: Date | null) {
  const lookbackDays = config.syncLookbackDays ?? 7;
  const lookaheadDays = config.syncLookaheadDays ?? 90;
  const now = new Date();
  const timeMin = new Date(now);
  if (incremental && lastSyncAt) {
    timeMin.setTime(lastSyncAt.getTime() - 2 * 24 * 60 * 60 * 1000);
  } else {
    timeMin.setDate(timeMin.getDate() - lookbackDays);
  }
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + lookaheadDays);
  return { timeMin, timeMax };
}

function resolveMicrosoftSyncWindowForCalendar(
  config: CalendarConfig,
  calendarId: string,
  incremental: boolean,
): { timeMin: Date; timeMax: Date } {
  const stored = config.microsoftDeltaLinks?.[calendarId];
  if (incremental && stored?.windowStart && stored?.windowEnd && !shouldAdvanceMicrosoftDeltaWindow(stored.windowEnd)) {
    return {
      timeMin: new Date(stored.windowStart),
      timeMax: new Date(stored.windowEnd),
    };
  }
  return resolveMicrosoftCalendarViewSyncWindow(config);
}

async function findExistingAppointment(
  workspaceId: string,
  provider: "google" | "microsoft",
  connectionId: string,
  event: ProviderCalendarEvent,
) {
  const importedId = formatImportedExternalId(provider, connectionId, event.id);
  const imported = await findWorkspaceAppointmentByExternalId(workspaceId, importedId);
  if (imported) return imported;

  const transovoBooked = await findWorkspaceAppointmentByExternalId(workspaceId, event.id);
  if (transovoBooked) return transovoBooked;

  const prisma = getPrisma();
  const byProviderMapping = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      externalId: event.id,
      metadata: { path: ["source"], equals: "transovo" },
    },
  });
  if (byProviderMapping) return byProviderMapping;

  const byMetadataEventId = await prisma.voiceAppointment.findFirst({
    where: {
      workspaceId,
      AND: [
        { metadata: { path: ["connectionId"], equals: connectionId } },
        { metadata: { path: ["providerEventId"], equals: event.id } },
      ],
    },
  });
  if (byMetadataEventId) return byMetadataEventId;

  return null;
}

function isTransovoOwnedProviderEvent(
  appointment: { externalId: string | null; metadata: unknown },
  providerEventId: string,
): boolean {
  if (isTransovoBookedExternalId(appointment.externalId) && appointment.externalId === providerEventId) {
    return true;
  }
  if (isTransovoOriginatedAppointment(appointment.metadata)) {
    const meta = (appointment.metadata || {}) as { providerEventId?: string };
    return meta.providerEventId === providerEventId || appointment.externalId === providerEventId;
  }
  return false;
}

async function syncTransovoBookedFromExternal(
  row: { id: string; metadata: unknown; startsAt: Date; endsAt: Date | null },
  event: ProviderCalendarEvent,
) {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const lastPushedAt = meta.lastPushedAt ? new Date(String(meta.lastPushedAt)).getTime() : 0;
  if (event.updatedAt && event.updatedAt.getTime() <= lastPushedAt) return null;

  const prisma = getPrisma();
  const status = event.status === "cancelled" ? "canceled" : undefined;
  const timesChanged =
    row.startsAt.getTime() !== event.start.getTime() ||
    (row.endsAt?.getTime() || 0) !== event.end.getTime();

  const updated = await prisma.voiceAppointment.update({
    where: { id: row.id },
    data: {
      startsAt: event.start,
      endsAt: event.end,
      timezone: event.timezone || undefined,
      ...(status ? { status } : {}),
      metadata: {
        ...meta,
        externalUpdatedAt: event.updatedAt?.toISOString(),
        lastExternalSyncAt: new Date().toISOString(),
      } as object,
    },
  });

  if (status === "canceled") {
    try {
      const { suppressAppointmentReminders } = await import("@/lib/appointments/reminder-state");
      await prisma.voiceAppointment.update({
        where: { id: row.id },
        data: {
          metadata: suppressAppointmentReminders({
            ...(updated.metadata || {}) as Record<string, unknown>,
          }) as object,
        },
      });
    } catch {
      // non-fatal
    }
  } else if (timesChanged) {
    try {
      const { resetAppointmentReminders } = await import("@/lib/appointments/reminder-state");
      await prisma.voiceAppointment.update({
        where: { id: row.id },
        data: {
          metadata: resetAppointmentReminders({
            ...(updated.metadata || {}) as Record<string, unknown>,
          }) as object,
        },
      });
    } catch {
      // non-fatal
    }
  }

  return updated;
}

export async function processCalendarProviderEvent(input: {
  workspaceId: string;
  connectionId: string;
  provider: "google" | "microsoft";
  event: ProviderCalendarEvent;
  config: CalendarConfig;
  calendarId?: string;
  microsoftAccessToken?: string | null;
}): Promise<{ result: ProcessEventResult; reason?: string }> {
  const { workspaceId, connectionId, provider, event, config } = input;
  const staffLabel = config.displayName?.trim() || config.email?.trim() || null;

  async function resolveImportContact(eventForContact: ProviderCalendarEvent) {
    const base = await resolveContactForImportedEvent(workspaceId, eventForContact, config.email);
    if (provider !== "microsoft") return base;
    return enrichContactWithOutlookGraphPhone(base, input.microsoftAccessToken);
  }
  const rules = resolveImportRulesForCalendar(config, input.calendarId);
  const existing = await findExistingAppointment(workspaceId, provider, connectionId, event);

  const transovoOwned = Boolean(existing && isTransovoOwnedProviderEvent(existing, event.id));
  const eventForProcessing: ProviderCalendarEvent = transovoOwned
    ? { ...event, transovoOriginated: true }
    : event;

  const mirrorEligibility = isEventEligibleForCalendarMirror(eventForProcessing);
  const reminderEligibility = isEventEligibleForReminderImport(eventForProcessing, rules, config.email);

  if (existing) {
    if (isTransovoOwnedProviderEvent(existing, event.id)) {
      const updated = await syncTransovoBookedFromExternal(existing, eventForProcessing);
      if (updated) return { result: event.status === "cancelled" ? "canceled" : "updated" };
      return { result: "skipped", reason: "transovo_no_change" };
    }

    const parsed = existing.externalId ? parseImportedExternalId(existing.externalId) : null;
    if (parsed && parsed.connectionId !== connectionId) {
      return { result: "skipped", reason: "other_connection" };
    }

    if (!mirrorEligibility.eligible && event.status !== "cancelled") {
      return { result: "skipped", reason: mirrorEligibility.reason };
    }

    const contact = await resolveImportContact(eventForProcessing);
    const externalId = formatImportedExternalId(provider, connectionId, event.id);
    const status = event.status === "cancelled" ? "canceled" : "confirmed";
    const prevMeta = (existing.metadata || {}) as Record<string, unknown>;
    const metadata = (await buildImportMetadata(
      workspaceId,
      event,
      provider,
      connectionId,
      contact,
      input.calendarId,
      reminderEligibility,
      prevMeta,
    )) as Record<string, unknown>;

    await upsertWorkspaceAppointmentByExternalId({
      workspaceId,
      externalId,
      create: {
        callId: null,
        contactId: contact.contactId,
        serviceName: event.summary || "Calendar event",
        staffName: staffLabel,
        startsAt: event.start,
        endsAt: event.end,
        timezone: event.timezone || null,
        status,
        metadata,
      },
      update: {
        contactId: contact.contactId,
        serviceName: event.summary || "Calendar event",
        staffName: staffLabel,
        startsAt: event.start,
        endsAt: event.end,
        timezone: event.timezone || null,
        status,
        metadata,
      },
    });

    await applyImportedAppointmentLifecycle(existing.id, status, existing, {
      startsAt: event.start,
      endsAt: event.end,
    });
    await applyImportedReminderEligibility(existing.id, reminderEligibility, existing.metadata);

    return { result: event.status === "cancelled" ? "canceled" : "updated" };
  }

  if (event.status === "cancelled") {
    return { result: "skipped", reason: "cancelled_unknown" };
  }

  if (!mirrorEligibility.eligible) {
    return { result: "skipped", reason: mirrorEligibility.reason };
  }

  const contact = await resolveImportContact(eventForProcessing);
  const externalId = formatImportedExternalId(provider, connectionId, event.id);
  const metadata = (await buildImportMetadata(
    workspaceId,
    eventForProcessing,
    provider,
    connectionId,
    contact,
    input.calendarId,
    reminderEligibility,
  )) as Record<string, unknown>;

  const existingBeforeImport = await getPrisma().voiceAppointment.findFirst({
    where: { workspaceId, externalId },
    select: { id: true },
  });

  const saved = await upsertWorkspaceAppointmentByExternalId({
    workspaceId,
    externalId,
    create: {
      callId: null,
      contactId: contact.contactId,
      serviceName: event.summary || "Calendar event",
      staffName: staffLabel,
      startsAt: event.start,
      endsAt: event.end,
      timezone: event.timezone || null,
      status: "confirmed",
      metadata,
    },
    update: {
      contactId: contact.contactId,
      serviceName: event.summary || "Calendar event",
      staffName: staffLabel,
      startsAt: event.start,
      endsAt: event.end,
      timezone: event.timezone || null,
      status: "confirmed",
      metadata,
    },
  });

  await applyImportedReminderEligibility(saved.id, reminderEligibility, null);

  const isNewImport = !existingBeforeImport;
  if (reminderEligibility.eligible && event.start.getTime() > Date.now() && isNewImport) {
    try {
      const { maybeSendImmediateConfirmationForAppointment } = await import(
        "@/lib/appointments/reminder-delivery"
      );
      const { loadAppointmentPlatformConfig } = await import("@/lib/appointments/settings");
      const platform = await loadAppointmentPlatformConfig(workspaceId);
      const skipHistorical =
        platform.reminderPreferences?.skipConfirmationOnHistoricalImport === true &&
        event.start.getTime() < Date.now() - 24 * 60 * 60_000;
      if (!skipHistorical) {
        await maybeSendImmediateConfirmationForAppointment(workspaceId, saved.id);
      }
    } catch (err) {
      console.warn("[calendar] immediate confirmation after import failed", saved.id, err);
    }
  }

  return { result: "imported" };
}

async function applyImportedAppointmentLifecycle(
  appointmentId: string,
  status: string,
  previous: { startsAt: Date; endsAt: Date | null; status: string },
  next: { startsAt: Date; endsAt: Date | null },
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({ where: { id: appointmentId } });
  if (!row) return;

  const timesChanged =
    previous.startsAt.getTime() !== next.startsAt.getTime() ||
    (previous.endsAt?.getTime() || 0) !== (next.endsAt?.getTime() || 0);
  const canceled = status === "canceled" || status === "cancelled";

  if (canceled) {
    const { suppressAppointmentReminders } = await import("@/lib/appointments/reminder-state");
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: suppressAppointmentReminders({
          ...(row.metadata || {}) as Record<string, unknown>,
          lastExternalSyncAt: new Date().toISOString(),
        }) as object,
      },
    });
    return;
  }

  if (timesChanged) {
    const { resetAppointmentReminders } = await import("@/lib/appointments/reminder-state");
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: resetAppointmentReminders({
          ...(row.metadata || {}) as Record<string, unknown>,
          lastExternalSyncAt: new Date().toISOString(),
        }) as object,
      },
    });
  }
}

async function applyImportedReminderEligibility(
  appointmentId: string,
  reminderEligibility: { eligible: boolean; reason?: string },
  previousMetadata: unknown,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({ where: { id: appointmentId } });
  if (!row) return;

  const prev = (previousMetadata || row.metadata || {}) as Record<string, unknown>;
  const wasEligible = prev.reminderSmsEligible === true;
  const base = { ...(row.metadata || {}) as Record<string, unknown> };

  if (!reminderEligibility.eligible) {
    const { suppressAppointmentReminders } = await import("@/lib/appointments/reminder-state");
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: suppressAppointmentReminders({
          ...base,
          reminderSmsEligible: false,
          reminderSmsIneligibleReason: reminderEligibility.reason,
        }) as object,
      },
    });
    return;
  }

  if (!wasEligible && reminderEligibility.eligible) {
    const { resetAppointmentReminders } = await import("@/lib/appointments/reminder-state");
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: resetAppointmentReminders({
          ...base,
          reminderSmsEligible: true,
          reminderSmsIneligibleReason: undefined,
        }) as object,
      },
    });
    return;
  }

  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: {
        ...base,
        reminderSmsEligible: true,
        reminderSmsIneligibleReason: undefined,
      } as object,
    },
  });
}

async function buildImportMetadata(
  workspaceId: string,
  event: ProviderCalendarEvent,
  provider: string,
  connectionId: string,
  contact: Awaited<ReturnType<typeof resolveContactForImportedEvent>>,
  calendarId?: string,
  reminderEligibility?: { eligible: boolean; reason?: string },
  previousMetadata?: Record<string, unknown> | null,
) {
  const phoneMerge = await mergeReminderPhoneOnImport({
    event,
    previousMetadata: (previousMetadata || null) as AppointmentMetadata | null,
    contactPhone: contact.inviteePhone,
  });

  const base = {
    source: "calendar_import",
    reminderSmsEligible: reminderEligibility?.eligible ?? false,
    reminderSmsIneligibleReason: reminderEligibility?.eligible
      ? undefined
      : reminderEligibility?.reason,
    provider,
    connectionId,
    calendarId,
    providerEventId: event.id,
    inviteeEmail: contact.inviteeEmail,
    inviteeName: contact.inviteeName,
    inviteePhone: phoneMerge.inviteePhone,
    reminderPhone: phoneMerge.reminderPhone,
    smsCapable: phoneMerge.smsCapable,
    emailOnly: phoneMerge.emailOnly,
    contactMatch: contact.matchedExistingContact ? "existing" : contact.createdContact ? "created" : "none",
    timezone: event.timezone,
    isAllDay: event.isAllDay,
    attendees: event.attendees,
    organizerEmail: event.organizerEmail,
    externalUpdatedAt: event.updatedAt?.toISOString(),
    lastExternalSyncAt: new Date().toISOString(),
    seriesMasterId: event.seriesMasterId,
    recurrenceType: event.type,
    recurrence: event.recurrence,
    originalStart: event.originalStart?.toISOString(),
    description: event.description,
    location: event.locationDisplay,
  } as AppointmentMetadata;

  return enrichImportMetadataWithRecipientSuppression(workspaceId, phoneMerge.inviteePhone, base);
}

export async function syncWorkspaceCalendarConnection(
  workspaceId: string,
  connectionId: string,
  options?: { incremental?: boolean; manual?: boolean },
): Promise<CalendarSyncStats> {
  const stats: CalendarSyncStats = {
    imported: 0,
    updated: 0,
    canceled: 0,
    skipped: 0,
    errors: 0,
  };

  const prisma = getPrisma();
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId },
  });
  if (!conn || !["google", "microsoft"].includes(conn.provider)) {
    throw new Error("Calendar connection not found");
  }

  const config = (conn.config || {}) as CalendarConfig;
  if (!config.importCalendarIds?.length) {
    return stats;
  }
  if (!options?.manual && !shouldImportFromConnection(config)) {
    return stats;
  }

  const provider = conn.provider as "google" | "microsoft";
  if (provider === "microsoft" && shouldImportFromConnection(config)) {
    await ensureMicrosoftCalendarSubscription(workspaceId, connectionId).catch((err) => {
      console.warn("[calendar] ensure microsoft subscription before sync failed", connectionId, err);
    });
  }

  const token = await getValidAccessToken(conn.id, provider, config);
  if (!token) {
    await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
      status: "needs_reauth",
    });
    throw new Error("Calendar access token unavailable — reconnect required");
  }

  const calendarIds = resolveImportCalendarIds(config);
  let microsoftConnectionHealthy = provider === "microsoft";

  for (const calendarId of calendarIds) {
    let events: ProviderCalendarEvent[] = [];
    let removedEventIds: string[] = [];
    let pendingDeltaLink: string | undefined;
    let calendarHadPersistError = false;
    const { timeMin, timeMax } =
      provider === "microsoft"
        ? resolveMicrosoftSyncWindowForCalendar(config, calendarId, Boolean(options?.incremental))
        : defaultSyncWindow(config, Boolean(options?.incremental), conn.lastSyncAt);
    try {
      if (provider === "google") {
        events = await listGoogleCalendarEvents(token, calendarId, timeMin, timeMax);
      } else {
        try {
          const stored = config.microsoftDeltaLinks?.[calendarId];
          const forceWindowAdvance = shouldAdvanceMicrosoftDeltaWindow(stored?.windowEnd);
          const delta = await syncMicrosoftCalendarDelta({
            workspaceId,
            connectionId,
            calendarId,
            config,
            timeMin,
            timeMax,
            forceFull: !options?.incremental || forceWindowAdvance,
          });
          events = delta.events;
          removedEventIds = delta.removedEventIds;
          pendingDeltaLink = delta.deltaLink;
        } catch (deltaErr) {
          console.warn("[calendar] microsoft delta sync failed, falling back to calendarView", connectionId, deltaErr);
          events = await listMicrosoftCalendarEventsForAppointmentDiscovery(
            token,
            timeMin,
            timeMax,
            calendarId,
            {
              connectionId: conn.id,
              config,
            },
          );
        }
      }
    } catch (err) {
      console.warn("[calendar] event import failed", connectionId, calendarId, err);
      stats.errors += 1;
      if (provider === "microsoft") {
        microsoftConnectionHealthy = false;
        const syncState = { ...(config.microsoftCalendarSyncState || {}) };
        syncState[calendarId] = {
          lastErrorAt: new Date().toISOString(),
          lastError: err instanceof Error ? err.message : String(err),
          consecutiveFailures: (syncState[calendarId]?.consecutiveFailures || 0) + 1,
        };
        config.microsoftCalendarSyncState = syncState;
      }
      continue;
    }

    for (const removedId of removedEventIds) {
      try {
        const importedId = formatImportedExternalId(provider, connectionId, removedId);
        const existing = await findWorkspaceAppointmentByExternalId(workspaceId, importedId);
        if (existing) {
          await getPrisma().voiceAppointment.update({
            where: { id: existing.id },
            data: { status: "canceled" },
          });
          await applyImportedAppointmentLifecycle(existing.id, "canceled", existing, {
            startsAt: existing.startsAt,
            endsAt: existing.endsAt,
          });
          stats.canceled += 1;
        }
      } catch (err) {
        console.warn("[calendar] delta removal reconcile failed", connectionId, removedId, err);
        stats.errors += 1;
      }
    }

    for (const event of events) {
      try {
        const { result } = await processCalendarProviderEvent({
          workspaceId,
          connectionId,
          provider,
          event,
          config,
          calendarId,
          microsoftAccessToken: provider === "microsoft" ? token : null,
        });
        if (result === "imported") stats.imported += 1;
        else if (result === "updated") stats.updated += 1;
        else if (result === "canceled") stats.canceled += 1;
        else stats.skipped += 1;
      } catch (err) {
        console.warn("[calendar] event upsert failed", connectionId, event.id, err);
        stats.errors += 1;
        calendarHadPersistError = true;
      }
    }

    if (provider === "microsoft") {
      if (calendarHadPersistError) {
        microsoftConnectionHealthy = false;
        const syncState = { ...(config.microsoftCalendarSyncState || {}) };
        syncState[calendarId] = {
          lastErrorAt: new Date().toISOString(),
          lastError: "event_persist_failed",
          consecutiveFailures: (syncState[calendarId]?.consecutiveFailures || 0) + 1,
        };
        config.microsoftCalendarSyncState = syncState;
      } else if (pendingDeltaLink) {
        await commitMicrosoftDeltaCheckpoint(
          workspaceId,
          connectionId,
          config,
          calendarId,
          timeMin,
          timeMax,
          pendingDeltaLink,
        );
        const syncState = { ...(config.microsoftCalendarSyncState || {}) };
        syncState[calendarId] = {
          lastSuccessAt: new Date().toISOString(),
          consecutiveFailures: 0,
        };
        config.microsoftCalendarSyncState = syncState;
      } else {
        const syncState = { ...(config.microsoftCalendarSyncState || {}) };
        syncState[calendarId] = {
          lastSuccessAt: new Date().toISOString(),
          consecutiveFailures: 0,
        };
        config.microsoftCalendarSyncState = syncState;
      }
    }
  }

  const freshConn = await getWorkspaceCalendarConnection(workspaceId, connectionId);
  const persistedConfig = mergeCalendarConnectionConfig(
    (freshConn?.config || {}) as Record<string, unknown>,
    {
      ...config,
      lastSyncError: microsoftConnectionHealthy ? null : config.lastSyncError,
    },
  );

  if (provider === "microsoft") {
    if (microsoftConnectionHealthy && stats.errors === 0) {
      await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
        status: "connected",
        config: persistedConfig,
      });
      await markMicrosoftSyncSuccess(connectionId);
    } else {
      await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
        config: persistedConfig,
        lastSyncError: "partial_or_failed_microsoft_sync",
      });
      await markMicrosoftSyncFailure(connectionId);
    }
  } else {
    await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
      lastSyncAt: stats.errors === 0 ? new Date() : conn.lastSyncAt,
      status: stats.errors === 0 ? "connected" : conn.status,
      config: persistedConfig,
    });
  }

  return stats;
}

export async function syncCalendarProviderEventById(input: {
  workspaceId: string;
  connectionId: string;
  provider: "google" | "microsoft";
  eventId: string;
  calendarId?: string;
}) {
  const prisma = getPrisma();
  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: input.connectionId, workspaceId: input.workspaceId },
  });
  if (!conn) throw new Error("Connection not found");
  const config = (conn.config || {}) as CalendarConfig;
  const token = await getValidAccessToken(conn.id, input.provider, config);
  if (!token) throw new Error("Token unavailable");

  const event =
    input.provider === "google"
      ? await getGoogleCalendarEvent(token, input.calendarId || "primary", input.eventId)
      : await getMicrosoftCalendarEvent(token, input.eventId, {
          connectionId: conn.id,
          config,
        });

  if (!event) {
    const importedId = formatImportedExternalId(input.provider, input.connectionId, input.eventId);
    const existing = await findWorkspaceAppointmentByExternalId(input.workspaceId, importedId);
    if (existing) {
      await getPrisma().voiceAppointment.update({
        where: { id: existing.id },
        data: { status: "canceled" },
      });
      await applyImportedAppointmentLifecycle(existing.id, "canceled", existing, {
        startsAt: existing.startsAt,
        endsAt: existing.endsAt,
      });
      return { result: "canceled" as ProcessEventResult, reason: "provider_deleted" };
    }
    return { result: "skipped" as ProcessEventResult, reason: "not_found" };
  }

  return processCalendarProviderEvent({
    workspaceId: input.workspaceId,
    connectionId: input.connectionId,
    provider: input.provider,
    event,
    config,
    calendarId: input.calendarId,
    microsoftAccessToken: input.provider === "microsoft" ? token : null,
  });
}

export type EnqueueCalendarConnectionSyncOptions = {
  /** Lower runs sooner on the default queue (webhook-driven sync uses ~15). */
  priority?: number;
  wake?: boolean;
};

export async function enqueueCalendarConnectionSync(
  workspaceId: string,
  connectionId: string,
  incremental = false,
  options?: EnqueueCalendarConnectionSyncOptions,
) {
  const { enqueueJob } = await import("@/lib/messaging/enqueue-advance");
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const idempotencyKey = `calendar-sync-${connectionId}-${incremental ? "inc" : "full"}-${minuteBucket}`;

  const prisma = getPrisma();
  const existing = await prisma.jobQueue.findUnique({ where: { idempotencyKey } });
  const syncAlreadyRunning = existing?.status === "processing";

  const job = await enqueueJob({
    jobType: "calendar_connection_sync",
    workspaceId,
    payload: { workspaceId, connectionId, incremental },
    idempotencyKey,
    priority: options?.priority,
    wake: options?.wake,
  });

  // Webhook coalescing uses the same minute bucket; if a sync is in-flight, queue one follow-up.
  if (syncAlreadyRunning) {
    const chaserKey = `${idempotencyKey}:chaser`;
    const chaserExists = await prisma.jobQueue.findUnique({ where: { idempotencyKey: chaserKey } });
    if (!chaserExists || chaserExists.status === "completed" || chaserExists.status === "failed") {
      await enqueueJob({
        jobType: "calendar_connection_sync",
        workspaceId,
        payload: { workspaceId, connectionId, incremental },
        idempotencyKey: chaserKey,
        runAfter: new Date(Date.now() + 5_000),
        priority: options?.priority ?? 15,
        wake: true,
      });
    }
  }

  return job;
}
