import "server-only";

import { getPrisma } from "@/lib/db";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata, AppointmentTypeConfig } from "@/lib/appointments/types";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { detectMeetingPlatform, isSupportedMeetingUrl } from "./platform";
import { assertAiNotetakerEntitlement } from "./entitlements";
import { resolveMeetingUrlFromMetadata, resolveMeetingUrlForAppointment } from "./meeting-url";
import { loadNotetakerConfig, resolveBotName, resolveNotetakerConfigForAppointment } from "./settings";
import {
  mapTelnyxMeetingSessionToDbPatch,
  mapTelnyxMeetingStatus,
  telnyxCancelMeetingSession,
  telnyxCreateMeetingSession,
  telnyxUpdateMeetingSession,
} from "./telnyx-provider";
import type { MeetingSessionStatus } from "./types";

export async function getMeetingSession(workspaceId: string, id: string) {
  const prisma = getPrisma();
  return prisma.meetingSession.findFirst({
    where: { id, workspaceId, deletedAt: null },
    include: {
      actionItems: { orderBy: { createdAt: "asc" } },
      transcriptSegments: { orderBy: { sequence: "asc" } },
      shares: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function listMeetingSessions(
  workspaceId: string,
  filter: "upcoming" | "past" | "all" = "all",
  source: "all" | "transovo_video" | "external" = "all",
) {
  const prisma = getPrisma();
  const now = new Date();
  const where: Record<string, unknown> = { workspaceId, deletedAt: null };
  if (filter === "upcoming") {
    where.status = { in: ["pending", "scheduled", "joining", "awaiting_admission", "active", "recording"] };
  } else if (filter === "past") {
    where.status = { in: ["ended", "processing", "completed", "failed", "no_recap", "canceled"] };
  }
  if (source === "transovo_video") {
    where.meetingSource = "transovo_video";
  } else if (source === "external") {
    where.meetingSource = { not: "transovo_video" };
  }
  return prisma.meetingSession.findMany({
    where,
    orderBy: { scheduledStartAt: "desc" },
    take: 100,
  });
}

export async function findMeetingForAppointment(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  return prisma.meetingSession.findFirst({
    where: { workspaceId, appointmentId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

async function appendAppointmentMeetingTimeline(
  workspaceId: string,
  appointmentId: string,
  event: { type: string; label: string; detail?: string },
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({ where: { id: appointmentId, workspaceId } });
  if (!row) return;
  const meta = (row.metadata || {}) as AppointmentMetadata;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: { metadata: appendTimeline(meta, event) as object },
  });
}

export async function enableNotetakerForAppointment(input: {
  workspaceId: string;
  appointmentId: string;
  meetingUrl?: string;
}) {
  await assertAiNotetakerEntitlement(input.workspaceId);
  const prisma = getPrisma();
  const config = await loadNotetakerConfig(input.workspaceId);
  if (!config.enabled) throw new Error("AI Notetaker is disabled for this workspace");

  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!appointment) throw new Error("Appointment not found");

  const meta = (appointment.metadata || {}) as AppointmentMetadata;
  const meetingUrl = input.meetingUrl?.trim() || resolveMeetingUrlForAppointment(meta);
  if (!meetingUrl || !isSupportedMeetingUrl(meetingUrl)) {
    throw new Error("A supported Zoom, Google Meet, Teams, or Webex meeting URL is required");
  }

  let eventTypeId: string | null = null;
  let eventTypeConfig: AppointmentTypeConfig | null = null;
  if (appointment.serviceName) {
    const svc = await prisma.voiceService.findFirst({
      where: { workspaceId: input.workspaceId, name: appointment.serviceName },
    });
    eventTypeId = svc?.id || null;
    eventTypeConfig = (svc?.config as AppointmentTypeConfig) || null;
  }

  const notetakerCfg = await resolveNotetakerConfigForAppointment({
    workspaceId: input.workspaceId,
    eventTypeId,
    eventTypeConfig,
  });

  const platform = detectMeetingPlatform(meetingUrl);
  const botName = await resolveBotName(input.workspaceId);
  const idempotencyKey = `appt:${input.appointmentId}`;

  const existing = await prisma.meetingSession.findFirst({
    where: { workspaceId: input.workspaceId, idempotencyKey, deletedAt: null },
  });

  if (existing?.providerSessionId && !["completed", "canceled", "failed", "disabled"].includes(existing.status)) {
    await prisma.meetingSession.update({
      where: { id: existing.id },
      data: {
        enabled: true,
        meetingUrl,
        meetingPlatform: platform,
        status: "scheduled",
        recordingEnabled: notetakerCfg.recordingEnabled,
        transcriptEnabled: notetakerCfg.transcriptEnabled,
        summaryEnabled: notetakerCfg.summaryEnabled,
        actionItemsEnabled: notetakerCfg.actionItemsEnabled,
        followUpEnabled: notetakerCfg.followUpEnabled,
        summaryTemplate: notetakerCfg.summaryTemplate,
      },
    });
    return existing;
  }

  let providerSessionId: string | null = null;
  let providerStatus = "scheduled";
  let providerPatch: Record<string, unknown> = {};
  try {
    const provider = await telnyxCreateMeetingSession({
      meetingUrl,
      botName,
      idempotencyKey,
      scheduledStartAt: appointment.startsAt,
      summarizeOnEnd: notetakerCfg.summaryEnabled,
      metadata: {
        workspace_id: input.workspaceId,
        appointment_id: input.appointmentId,
      },
    });
    providerSessionId = String(provider.id || "");
    providerStatus = String(provider.status || "scheduled");
    providerPatch = mapTelnyxMeetingSessionToDbPatch(provider);
  } catch (err) {
    if (!process.env.TELNYX_API_KEY) {
      providerStatus = "scheduled";
    } else {
      throw err;
    }
  }

  const sessionData = {
    enabled: true,
    meetingUrl,
    meetingPlatform: platform,
    meetingSource: "external_notetaker",
    botName,
    scheduledStartAt: appointment.startsAt,
    providerSessionId,
    status: mapTelnyxMeetingStatus(providerStatus),
    contactId: appointment.contactId,
    title: appointment.serviceName || "Meeting",
    eventTypeId,
    failureCode: null,
    failureMessage: null,
    recordingEnabled: notetakerCfg.recordingEnabled,
    transcriptEnabled: notetakerCfg.transcriptEnabled,
    summaryEnabled: notetakerCfg.summaryEnabled,
    actionItemsEnabled: notetakerCfg.actionItemsEnabled,
    followUpEnabled: notetakerCfg.followUpEnabled,
    summaryTemplate: notetakerCfg.summaryTemplate,
    ...providerPatch,
  };

  const session = existing
    ? await prisma.meetingSession.update({
        where: { id: existing.id },
        data: sessionData,
      })
    : await prisma.meetingSession.create({
        data: {
          workspaceId: input.workspaceId,
          appointmentId: input.appointmentId,
          idempotencyKey,
          ...sessionData,
        },
      });

  const nextMeta = {
    ...meta,
    meetingUrl,
    notetakerEnabled: true,
    meetingSessionId: session.id,
  };
  await prisma.voiceAppointment.update({
    where: { id: appointment.id },
    data: { metadata: nextMeta as object },
  });

  await appendAppointmentMeetingTimeline(input.workspaceId, input.appointmentId, {
    type: "notetaker_enabled",
    label: "AI Notetaker enabled",
    detail: meetingPlatformLabelSafe(platform),
  });

  return session;
}

export async function enableStandaloneNotetaker(input: {
  workspaceId: string;
  meetingUrl: string;
  title?: string;
  botName?: string;
  scheduledStartAt?: Date | null;
  recordingEnabled?: boolean;
  transcriptEnabled?: boolean;
  summaryEnabled?: boolean;
  actionItemsEnabled?: boolean;
}) {
  await assertAiNotetakerEntitlement(input.workspaceId);
  const prisma = getPrisma();
  const config = await loadNotetakerConfig(input.workspaceId);
  if (!config.enabled) throw new Error("AI Notetaker is disabled for this workspace");

  const meetingUrl = input.meetingUrl.trim();
  if (!meetingUrl || !isSupportedMeetingUrl(meetingUrl)) {
    throw new Error("A supported Zoom, Google Meet, Teams, or Webex meeting URL is required");
  }

  const notetakerCfg = await resolveNotetakerConfigForAppointment({
    workspaceId: input.workspaceId,
  });
  const platform = detectMeetingPlatform(meetingUrl);
  const botName = input.botName?.trim() || (await resolveBotName(input.workspaceId));
  const scheduledStartAt = input.scheduledStartAt || new Date();
  const idempotencyKey = `standalone:${crypto.randomUUID()}`;

  let providerSessionId: string | null = null;
  let providerStatus = "scheduled";
  let providerPatch: Record<string, unknown> = {};
  try {
    const provider = await telnyxCreateMeetingSession({
      meetingUrl,
      botName,
      idempotencyKey,
      scheduledStartAt,
      summarizeOnEnd: notetakerCfg.summaryEnabled,
      metadata: {
        workspace_id: input.workspaceId,
        source: "standalone",
      },
    });
    providerSessionId = String(provider.id || "");
    providerStatus = String(provider.status || "scheduled");
    providerPatch = mapTelnyxMeetingSessionToDbPatch(provider);
  } catch (err) {
    if (!process.env.TELNYX_API_KEY) {
      providerStatus = "scheduled";
    } else {
      throw err;
    }
  }

  const session = await prisma.meetingSession.create({
    data: {
      workspaceId: input.workspaceId,
      appointmentId: null,
      idempotencyKey,
      enabled: true,
      meetingUrl,
      meetingPlatform: platform,
      meetingSource: "external_notetaker",
      botName,
      scheduledStartAt,
      providerSessionId,
      status: mapTelnyxMeetingStatus(providerStatus),
      title: input.title?.trim() || "External meeting",
      recordingEnabled: input.recordingEnabled ?? notetakerCfg.recordingEnabled,
      transcriptEnabled: input.transcriptEnabled ?? notetakerCfg.transcriptEnabled,
      summaryEnabled: input.summaryEnabled ?? notetakerCfg.summaryEnabled,
      actionItemsEnabled: input.actionItemsEnabled ?? notetakerCfg.actionItemsEnabled,
      followUpEnabled: notetakerCfg.followUpEnabled,
      summaryTemplate: notetakerCfg.summaryTemplate,
      ...providerPatch,
    },
  });

  return session;
}

export async function rescheduleStandaloneMeetingSession(input: {
  workspaceId: string;
  sessionId: string;
  scheduledStartAt: Date;
}) {
  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({
    where: { id: input.sessionId, workspaceId: input.workspaceId, deletedAt: null },
  });
  if (!session) throw new Error("Meeting not found");
  if (session.appointmentId) throw new Error("Use appointment reschedule for linked meetings");

  if (session.providerSessionId && process.env.TELNYX_API_KEY) {
    await telnyxUpdateMeetingSession(session.providerSessionId, {
      scheduled_start_time: input.scheduledStartAt.toISOString(),
    }).catch(() => undefined);
  }

  return prisma.meetingSession.update({
    where: { id: session.id },
    data: {
      scheduledStartAt: input.scheduledStartAt,
      status: session.status === "canceled" ? "scheduled" : session.status,
    },
  });
}

function meetingPlatformLabelSafe(platform: string): string {
  return platform.replace(/_/g, " ");
}

export async function disableNotetakerForSession(workspaceId: string, sessionId: string) {
  const prisma = getPrisma();
  const session = await prisma.meetingSession.findFirst({
    where: { id: sessionId, workspaceId, deletedAt: null },
  });
  if (!session) throw new Error("Meeting session not found");

  if (session.providerSessionId && process.env.TELNYX_API_KEY) {
    await telnyxCancelMeetingSession(session.providerSessionId).catch(() => undefined);
  }

  const updated = await prisma.meetingSession.update({
    where: { id: session.id },
    data: { enabled: false, status: "disabled" },
  });

  if (session.appointmentId) {
    const row = await prisma.voiceAppointment.findFirst({
      where: { id: session.appointmentId, workspaceId },
    });
    if (row) {
      const meta = (row.metadata || {}) as AppointmentMetadata;
      await prisma.voiceAppointment.update({
        where: { id: session.appointmentId },
        data: {
          metadata: {
            ...meta,
            notetakerEnabled: false,
            meetingSessionId: session.id,
          } as object,
        },
      });
    }
    await appendAppointmentMeetingTimeline(workspaceId, session.appointmentId, {
      type: "notetaker_disabled",
      label: "AI Notetaker disabled",
    });
  }
  return updated;
}

export async function syncAppointmentMeetingSession(input: {
  workspaceId: string;
  appointmentId: string;
}) {
  const prisma = getPrisma();
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (!appointment) return null;

  const meta = (appointment.metadata || {}) as AppointmentMetadata;
  if (!meta.notetakerEnabled && meta.meetingSessionId) {
    return disableNotetakerForSession(input.workspaceId, String(meta.meetingSessionId));
  }

  const session = await findMeetingForAppointment(input.workspaceId, input.appointmentId);
  if (!session || session.status === "canceled" || session.status === "disabled") return session;

  const meetingUrl = resolveMeetingUrlForAppointment(meta);
  if (session.providerSessionId && meetingUrl && process.env.TELNYX_API_KEY) {
    await telnyxUpdateMeetingSession(session.providerSessionId, {
      meeting_url: meetingUrl,
      scheduled_start_time: appointment.startsAt.toISOString(),
    }).catch(() => undefined);
  }

  return prisma.meetingSession.update({
    where: { id: session.id },
    data: {
      scheduledStartAt: appointment.startsAt,
      meetingUrl: meetingUrl || session.meetingUrl,
    },
  });
}

export async function getMeetingSessionsForAppointment(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  const videoMeeting = await prisma.videoMeeting.findFirst({
    where: { workspaceId, appointmentId, provisioningStatus: { not: "deleted" } },
    orderBy: { createdAt: "desc" },
  });
  const sessions = await prisma.meetingSession.findMany({
    where: { workspaceId, appointmentId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      actionItems: { orderBy: { createdAt: "asc" }, take: 5 },
    },
  });
  return { sessions, videoMeeting };
}

export async function updateMeetingSessionStatus(
  sessionId: string,
  status: MeetingSessionStatus,
  patch?: Record<string, unknown>,
) {
  const prisma = getPrisma();
  return prisma.meetingSession.update({
    where: { id: sessionId },
    data: { status, ...patch },
  });
}

export async function enqueueMeetingProcessing(sessionId: string, workspaceId: string) {
  await enqueueJob({
    jobType: "meeting_assistant_process",
    workspaceId,
    payload: { sessionId },
    idempotencyKey: `meeting-process:${sessionId}`,
  });
}
