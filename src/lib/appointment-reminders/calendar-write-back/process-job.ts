import "server-only";

import { getPrisma } from "@/lib/db";
import type { CalendarConfig } from "@/lib/calendar/providers";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { applyMicrosoftCalendarWriteBack } from "./microsoft";
import { markWriteBackTimeline } from "./enqueue";
import { resolveArCalendarWriteBackSettings } from "./settings";
import type { ArCalendarWriteBackJobPayload, AppointmentMetadataWithWriteBack } from "./types";

export async function processArCalendarWriteBackJob(
  payload: ArCalendarWriteBackJobPayload,
): Promise<{ ok: boolean; reason?: string }> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: payload.appointmentId, workspaceId: payload.workspaceId },
  });
  if (!row) return { ok: false, reason: "appointment_not_found" };

  const meta = (row.metadata || {}) as AppointmentMetadataWithWriteBack;
  const current = meta.arCalendarWriteBack;
  if (current && current.revision > payload.revision) {
    return { ok: true, reason: "superseded" };
  }
  if (current && current.revision === payload.revision && current.lastStatus === "succeeded") {
    return { ok: true, reason: "already_succeeded" };
  }

  const ref = (await import("@/lib/appointment-reminders/ai-rescheduler/provider-mutations")).providerRefFromAppointment(row);
  if (!ref || ref.provider !== "microsoft") {
    await persistWriteBackState(row.id, meta, payload, {
      lastStatus: "skipped",
      lastError: "No Microsoft calendar link",
    });
    return { ok: true, reason: "skipped" };
  }

  const conn = await prisma.voiceCalendarConnection.findFirst({
    where: { id: ref.connectionId, workspaceId: payload.workspaceId },
  });
  if (!conn || conn.status === "disconnected") {
    await persistWriteBackState(row.id, meta, payload, {
      lastStatus: "failed",
      lastError: "Calendar connection unavailable",
    });
    await markWriteBackTimeline(payload.workspaceId, payload.appointmentId, payload.kind, "Reconnect calendar", true);
    return { ok: false, reason: "no_connection" };
  }

  const config = (conn.config || {}) as CalendarConfig;
  const platform = await loadAppointmentPlatformConfig(payload.workspaceId);
  const wbSettings = resolveArCalendarWriteBackSettings(platform);
  const result = await applyMicrosoftCalendarWriteBack({
    workspaceId: payload.workspaceId,
    appointment: row,
    connectionId: conn.id,
    config,
    job: payload,
    colorCodingEnabled: wbSettings.colorCodingEnabled,
  });

  if (!result.ok) {
    await persistWriteBackState(row.id, meta, payload, {
      lastStatus: "failed",
      lastError: result.message,
    });
    await markWriteBackTimeline(payload.workspaceId, payload.appointmentId, payload.kind, result.message, true);
    if (result.retryable) {
      throw new Error(result.message);
    }
    return { ok: false, reason: result.message };
  }

  await persistWriteBackState(row.id, meta, payload, {
    lastStatus: result.skipped ? "skipped" : "succeeded",
    lastSucceededAt: new Date().toISOString(),
    lastProviderEtag: result.providerEtag,
    lastError: undefined,
  });
  if (!result.skipped) {
    await markWriteBackTimeline(payload.workspaceId, payload.appointmentId, payload.kind, payload.kind);
  }
  return { ok: true };
}

async function persistWriteBackState(
  appointmentId: string,
  meta: AppointmentMetadataWithWriteBack,
  payload: ArCalendarWriteBackJobPayload,
  patch: Partial<AppointmentMetadataWithWriteBack["arCalendarWriteBack"]>,
): Promise<void> {
  const prisma = getPrisma();
  const prev = meta.arCalendarWriteBack || {
    revision: payload.revision,
    lastStatus: "pending" as const,
  };
  const next: AppointmentMetadata = {
    ...meta,
    arCalendarWriteBack: {
      ...prev,
      revision: payload.revision,
      lastKind: payload.kind,
      provider: "microsoft",
      lastAttemptAt: new Date().toISOString(),
      ...patch,
    },
  };
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { metadata: next as object },
  });
}
