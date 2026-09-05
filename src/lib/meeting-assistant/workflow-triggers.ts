import "server-only";

import { getPrisma } from "@/lib/db";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import { resolveMeetingUrlForAppointment } from "./meeting-url";
import { isSupportedMeetingUrl } from "./platform";
import { loadNotetakerConfig, parseEventTypeNotetakerConfig } from "./settings";

/** Fire workflow triggers when a meeting ends. */
export async function onMeetingCompleted(
  workspaceId: string,
  meetingSessionId: string,
  appointmentId?: string | null,
) {
  if (!appointmentId) return;
  try {
    const { dispatchAppointmentWorkflowTrigger } = await import("@/lib/appointment-workflows/engine");
    await dispatchAppointmentWorkflowTrigger({
      workspaceId,
      appointmentId,
      trigger: "meeting_completed",
    });
  } catch (err) {
    console.warn("[meeting-assistant] meeting_completed workflow trigger failed", err);
  }
}

export async function onMeetingRecapReady(
  workspaceId: string,
  meetingSessionId: string,
  appointmentId?: string | null,
) {
  if (!appointmentId) return;
  try {
    const { dispatchAppointmentWorkflowTrigger } = await import("@/lib/appointment-workflows/engine");
    await dispatchAppointmentWorkflowTrigger({
      workspaceId,
      appointmentId,
      trigger: "meeting_recap_ready",
    });
  } catch (err) {
    console.warn("[meeting-assistant] meeting_recap_ready workflow trigger failed", err);
  }
}

function shouldAutoJoinForRule(input: {
  joinRule: string;
  meta: Record<string, unknown>;
  eventTypeConfig: AppointmentTypeConfig | null;
  selectedEventTypeIds?: string[];
  externalParticipantsOnly?: boolean;
}): boolean {
  const { joinRule, meta, eventTypeConfig, selectedEventTypeIds, externalParticipantsOnly } = input;

  if (joinRule === "manual_only") return false;
  if (joinRule === "all_supported") return true;
  if (joinRule === "transovo_only") {
    const source = String(meta.source || "");
    return source === "admin" || source === "public_booking" || source === "api";
  }
  if (joinRule === "selected_types") {
    const typeId = typeof meta.serviceId === "string" ? meta.serviceId : null;
    if (!typeId || !selectedEventTypeIds?.length) return false;
    return selectedEventTypeIds.includes(typeId);
  }
  if (joinRule === "connected_calendar") {
    const source = String(meta.source || "");
    return source === "calendly" || Boolean(meta.eventUrl);
  }
  if (joinRule === "external_participants") {
    if (!externalParticipantsOnly) return true;
    const attendeeCount = Number(meta.attendeeCount || 1);
    return attendeeCount > 1;
  }
  if (eventTypeConfig?.notetaker?.autoJoin) return true;
  return false;
}

export async function autoEnableNotetakerForAppointment(workspaceId: string, appointmentId: string) {
  const { enableNotetakerForAppointment, findMeetingForAppointment } = await import("./service");

  const config = await loadNotetakerConfig(workspaceId);
  if (!config.enabled) return null;

  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!appointment) return null;

  const meta = (appointment.metadata || {}) as Record<string, unknown>;
  const meetingUrl = resolveMeetingUrlForAppointment(meta as import("@/lib/appointments/types").AppointmentMetadata);
  if (!meetingUrl || !isSupportedMeetingUrl(meetingUrl)) return null;

  let eventTypeConfig: AppointmentTypeConfig | null = null;
  if (appointment.serviceName) {
    const svc = await prisma.voiceService.findFirst({
      where: { workspaceId, name: appointment.serviceName },
    });
    eventTypeConfig = (svc?.config as AppointmentTypeConfig) || null;
    if (svc?.id) meta.serviceId = svc.id;
  }

  const eventNotetaker = parseEventTypeNotetakerConfig(eventTypeConfig?.notetaker);
  if (eventNotetaker.enabled === false) return null;

  if (
    !shouldAutoJoinForRule({
      joinRule: config.joinRule || "transovo_only",
      meta,
      eventTypeConfig,
      selectedEventTypeIds: config.selectedEventTypeIds,
      externalParticipantsOnly: config.externalParticipantsOnly,
    }) &&
    !eventNotetaker.autoJoin
  ) {
    return null;
  }

  const existing = await findMeetingForAppointment(workspaceId, appointmentId);
  if (existing && existing.enabled && existing.status !== "disabled") return existing;

  return enableNotetakerForAppointment({ workspaceId, appointmentId, meetingUrl });
}
