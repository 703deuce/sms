import "server-only";

import { getPrisma } from "@/lib/db";
import { onMeetingCompleted, onMeetingRecapReady } from "@/lib/meeting-assistant/workflow-triggers";
import {
  isTransovoVideoLocation,
  type EventTypeVideoConfig,
} from "./types";
import {
  findVideoMeetingForAppointment,
  provisionVideoMeetingForAppointment,
  resolveHostUserIdForStaffMember,
  resolveVideoConfigForAppointment,
} from "./service";

export async function onTransovoVideoMeetingCompleted(
  workspaceId: string,
  meetingSessionId: string,
  appointmentId?: string | null,
) {
  await onMeetingCompleted(workspaceId, meetingSessionId, appointmentId);
}

export async function onTransovoVideoRecapReady(
  workspaceId: string,
  meetingSessionId: string,
  appointmentId?: string | null,
) {
  await onMeetingRecapReady(workspaceId, meetingSessionId, appointmentId);
}

export async function autoProvisionTransovoVideoForAppointment(
  workspaceId: string,
  appointmentId: string,
) {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!appointment) return null;

  const meta = (appointment.metadata || {}) as Record<string, unknown>;
  const locationName = typeof meta.location === "string" ? meta.location : undefined;
  const locationKind = typeof meta.locationKind === "string" ? meta.locationKind : undefined;

  let eventTypeConfig: import("@/lib/appointments/types").AppointmentTypeConfig | null = null;
  let eventTypeId: string | null = null;
  if (appointment.serviceName) {
    const svc = await prisma.voiceService.findFirst({
      where: { workspaceId, name: appointment.serviceName },
    });
    eventTypeId = svc?.id || null;
    eventTypeConfig = (svc?.config as import("@/lib/appointments/types").AppointmentTypeConfig) || null;
  }

  const should =
    isTransovoVideoLocation({ kind: locationKind, name: locationName }) ||
    Boolean(eventTypeConfig?.transovoVideo?.enabled);
  if (!should) return null;

  const existing = await findVideoMeetingForAppointment(workspaceId, appointmentId);
  if (existing?.provisioningStatus === "ready") return existing;

  const videoConfig = await resolveVideoConfigForAppointment({
    workspaceId,
    eventTypeId,
    eventTypeConfig,
  });

  const durationMs = appointment.endsAt
    ? appointment.endsAt.getTime() - appointment.startsAt.getTime()
    : 30 * 60_000;

  const staffMemberId = typeof meta.staffId === "string" ? meta.staffId : null;
  const hostUserId = await resolveHostUserIdForStaffMember(workspaceId, staffMemberId);

  return provisionVideoMeetingForAppointment({
    workspaceId,
    appointmentId,
    eventTypeId,
    hostUserId,
    title: appointment.serviceName || "Video meeting",
    scheduledStartAt: appointment.startsAt,
    scheduledEndAt: new Date(appointment.startsAt.getTime() + durationMs),
    videoConfig,
  });
}
