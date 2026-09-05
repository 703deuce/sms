import "server-only";

import { getPrisma } from "@/lib/db";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata, AppointmentTypeConfig } from "@/lib/appointments/types";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { assertTransovoVideoEntitlement } from "./entitlements";
import { JoinAccessError, assertJoinAccess } from "./access";
import { publicVideoMeetingUrl } from "./meeting-url";
import { loadTransovoVideoConfig, resolveEventTypeVideoConfig } from "./settings";
import {
  buildParticipantContext,
  generatePublicMeetingToken,
  hashMeetingPasscode,
} from "./tokens";
import {
  telnyxCreateVideoRoom,
  telnyxDeleteVideoRoom,
  telnyxEndRoomSession,
  telnyxGenerateJoinClientToken,
  telnyxKickRoomParticipants,
  telnyxMuteRoomParticipants,
  telnyxRetrieveVideoRoom,
  telnyxUnmuteRoomParticipants,
} from "./telnyx-video-provider";
import {
  TELNYX_VIDEO_MAX_PARTICIPANTS,
  TELNYX_VIDEO_MIN_PARTICIPANTS,
  isTransovoVideoLocation,
  type EventTypeVideoConfig,
  type VideoParticipantRole,
} from "./types";

export { JoinAccessError } from "./access";

function clampParticipants(n: number): number {
  return Math.max(TELNYX_VIDEO_MIN_PARTICIPANTS, Math.min(TELNYX_VIDEO_MAX_PARTICIPANTS, n));
}

function recordingEnabledForMode(mode: string): boolean {
  return mode === "automatic" || mode === "manual";
}

async function appendAppointmentVideoTimeline(
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

export async function findVideoMeetingByToken(publicMeetingToken: string) {
  const prisma = getPrisma();
  return prisma.videoMeeting.findFirst({
    where: { publicMeetingToken, provisioningStatus: { not: "deleted" } },
  });
}

export async function findVideoMeetingForAppointment(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  return prisma.videoMeeting.findFirst({
    where: { workspaceId, appointmentId, provisioningStatus: { not: "deleted" } },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveHostUserIdForStaffMember(
  workspaceId: string,
  staffMemberId: string | null | undefined,
): Promise<string | null> {
  if (!staffMemberId) return null;
  const prisma = getPrisma();
  const staff = await prisma.voiceStaffMember.findFirst({
    where: { id: staffMemberId, workspaceId },
    select: { email: true },
  });
  if (!staff?.email) return null;
  const user = await prisma.user.findFirst({
    where: { email: staff.email.trim().toLowerCase() },
    select: { id: true },
  });
  if (!user) return null;
  const membership = await prisma.membership.findFirst({
    where: { workspaceId, userId: user.id },
    select: { id: true },
  });
  return membership ? user.id : null;
}

export async function isAuthorizedVideoHost(input: {
  workspaceId: string;
  meeting: { hostUserId?: string | null; appointmentId?: string | null };
  userId: string;
  email?: string | null;
}): Promise<boolean> {
  if (input.meeting.hostUserId && input.meeting.hostUserId === input.userId) {
    return true;
  }

  const prisma = getPrisma();
  const email = input.email?.trim().toLowerCase() || "";

  if (input.meeting.hostUserId) {
    const legacyStaff = await prisma.voiceStaffMember.findFirst({
      where: { id: input.meeting.hostUserId, workspaceId: input.workspaceId },
      select: { email: true },
    });
    if (legacyStaff?.email && legacyStaff.email.trim().toLowerCase() === email) {
      return true;
    }
  }

  if (input.meeting.appointmentId) {
    const appointment = await prisma.voiceAppointment.findFirst({
      where: { id: input.meeting.appointmentId, workspaceId: input.workspaceId },
      select: { metadata: true },
    });
    const meta = (appointment?.metadata || {}) as AppointmentMetadata;
    if (typeof meta.staffId === "string") {
      const assignedStaff = await prisma.voiceStaffMember.findFirst({
        where: { id: meta.staffId, workspaceId: input.workspaceId },
        select: { email: true },
      });
      if (assignedStaff?.email && assignedStaff.email.trim().toLowerCase() === email) {
        return true;
      }
    }
  }

  const membership = await prisma.membership.findFirst({
    where: { workspaceId: input.workspaceId, userId: input.userId },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function requestStaffVideoJoin(input: {
  workspaceId: string;
  appointmentId: string;
  userId: string;
  email?: string | null;
  name?: string | null;
}) {
  const meeting = await findVideoMeetingForAppointment(input.workspaceId, input.appointmentId);
  if (!meeting) throw new Error("Video meeting not found");

  const authorized = await isAuthorizedVideoHost({
    workspaceId: input.workspaceId,
    meeting,
    userId: input.userId,
    email: input.email,
  });
  if (!authorized) throw new Error("Not authorized to host this meeting.");

  const displayName = input.name?.trim() || input.email?.split("@")[0] || "Host";
  return requestVideoJoin({
    publicMeetingToken: meeting.publicMeetingToken,
    displayName,
    email: input.email || undefined,
    userId: input.userId,
    isStaffHost: true,
  });
}

export async function getVideoMeeting(workspaceId: string, id: string) {
  const prisma = getPrisma();
  return prisma.videoMeeting.findFirst({
    where: { id, workspaceId, provisioningStatus: { not: "deleted" } },
    include: {
      participants: { orderBy: { createdAt: "asc" } },
      meetingSession: true,
    },
  });
}

export async function listVideoMeetings(
  workspaceId: string,
  filter: "upcoming" | "past" | "all" = "all",
) {
  const prisma = getPrisma();
  const where: Record<string, unknown> = {
    workspaceId,
    provisioningStatus: { not: "deleted" },
  };
  if (filter === "upcoming") {
    where.status = { in: ["scheduled", "waiting", "active"] };
  } else if (filter === "past") {
    where.status = { in: ["ended", "canceled", "failed"] };
  }
  return prisma.videoMeeting.findMany({
    where,
    orderBy: { scheduledStartAt: "desc" },
    take: 100,
  });
}

export async function resolveVideoConfigForAppointment(input: {
  workspaceId: string;
  eventTypeId?: string | null;
  eventTypeConfig?: AppointmentTypeConfig | null;
}): Promise<EventTypeVideoConfig> {
  const platform = await loadTransovoVideoConfig(input.workspaceId);
  let eventConfig = input.eventTypeConfig?.transovoVideo;
  if (!eventConfig && input.eventTypeId) {
    const prisma = getPrisma();
    const svc = await prisma.voiceService.findFirst({
      where: { id: input.eventTypeId, workspaceId: input.workspaceId },
    });
    eventConfig = (svc?.config as AppointmentTypeConfig | null)?.transovoVideo;
  }
  return resolveEventTypeVideoConfig(platform, eventConfig);
}

export async function provisionVideoMeetingForAppointment(input: {
  workspaceId: string;
  appointmentId: string;
  eventTypeId?: string | null;
  hostUserId?: string | null;
  title?: string;
  scheduledStartAt: Date;
  scheduledEndAt?: Date | null;
  videoConfig?: EventTypeVideoConfig;
}): Promise<{ videoMeetingId: string; meetingUrl: string }> {
  await assertTransovoVideoEntitlement(input.workspaceId);
  const prisma = getPrisma();
  const platform = await loadTransovoVideoConfig(input.workspaceId);
  if (!platform.enabled) throw new Error("Transovo Video is disabled for this workspace");

  const videoConfig =
    input.videoConfig ||
    (await resolveVideoConfigForAppointment({
      workspaceId: input.workspaceId,
      eventTypeId: input.eventTypeId,
    }));

  const idempotencyKey = `appt:${input.appointmentId}`;
  const existing = await prisma.videoMeeting.findFirst({
    where: { workspaceId: input.workspaceId, idempotencyKey },
  });
  if (existing?.provisioningStatus === "ready" && existing.providerRoomId) {
    const url = publicVideoMeetingUrl(existing.publicMeetingToken);
    return { videoMeetingId: existing.id, meetingUrl: url };
  }

  const publicMeetingToken = existing?.publicMeetingToken || generatePublicMeetingToken();
  const maxParticipants = clampParticipants(videoConfig.maxParticipants || 10);
  const passcodeHash =
    videoConfig.requirePasscode && videoConfig.passcode
      ? await hashMeetingPasscode(videoConfig.passcode)
      : null;

  const baseData = {
    workspaceId: input.workspaceId,
    appointmentId: input.appointmentId,
    eventTypeId: input.eventTypeId || null,
    hostUserId: input.hostUserId || null,
    title: input.title || "Video meeting",
    scheduledStartAt: input.scheduledStartAt,
    scheduledEndAt: input.scheduledEndAt || null,
    maxParticipants,
    waitingRoomEnabled: Boolean(videoConfig.waitingRoom),
    requireHost: Boolean(videoConfig.requireHost),
    requireGuestEmail: Boolean(videoConfig.requireGuestEmail),
    requireGuestName: Boolean(videoConfig.requireGuestName),
    passcodeHash,
    recordingMode: videoConfig.recordingMode || "off",
    transcriptionEnabled: Boolean(videoConfig.transcription),
    aiRecapEnabled: Boolean(videoConfig.aiRecap),
    chatEnabled: Boolean(videoConfig.guestChat),
    screenSharePolicy: videoConfig.guestScreenShare ? "all" : "host_only",
    guestCameraEnabled: Boolean(videoConfig.guestCamera),
    guestMicEnabled: Boolean(videoConfig.guestMicrophone),
    postMeetingRedirect: videoConfig.postMeetingRedirect || null,
    recordingStatus: recordingEnabledForMode(videoConfig.recordingMode || "off")
      ? "pending"
      : "disabled",
    transcriptStatus: videoConfig.transcription ? "pending" : "disabled",
    compositionStatus: recordingEnabledForMode(videoConfig.recordingMode || "off")
      ? "pending"
      : "disabled",
    idempotencyKey,
    provisioningStatus: "provisioning",
  };

  const meeting = existing
    ? await prisma.videoMeeting.update({ where: { id: existing.id }, data: baseData })
    : await prisma.videoMeeting.create({
        data: { ...baseData, publicMeetingToken, status: "scheduled" },
      });

  let providerRoomId = meeting.providerRoomId;
  try {
    if (!providerRoomId) {
      const room = await telnyxCreateVideoRoom({
        uniqueName: `transovo-${meeting.id}`,
        maxParticipants,
        enableRecording: recordingEnabledForMode(meeting.recordingMode),
        idempotencyKey: `room:${meeting.id}`,
      });
      providerRoomId = room.id;
    }
    await prisma.videoMeeting.update({
      where: { id: meeting.id },
      data: {
        providerRoomId,
        provisioningStatus: "ready",
        status: "scheduled",
      },
    });
  } catch (err) {
    if (!process.env.TELNYX_API_KEY) {
      await prisma.videoMeeting.update({
        where: { id: meeting.id },
        data: { provisioningStatus: "ready", status: "scheduled" },
      });
    } else {
      await prisma.videoMeeting.update({
        where: { id: meeting.id },
        data: {
          provisioningStatus: "failed",
          providerMetadata: { error: String(err) } as object,
        },
      });
      throw err;
    }
  }

  const meetingUrl = publicVideoMeetingUrl(meeting.publicMeetingToken);
  const appointment = await prisma.voiceAppointment.findFirst({
    where: { id: input.appointmentId, workspaceId: input.workspaceId },
  });
  if (appointment) {
    const meta = (appointment.metadata || {}) as AppointmentMetadata;
    await prisma.voiceAppointment.update({
      where: { id: appointment.id },
      data: {
        metadata: {
          ...meta,
          meetingUrl,
          joinUrl: meetingUrl,
          videoMeetingId: meeting.id,
          locationKind: "transovo_video",
        } as object,
      },
    });
  }

  if (videoConfig.aiRecap || videoConfig.transcription || recordingEnabledForMode(meeting.recordingMode)) {
    await ensureMeetingSessionForVideo(meeting.id);
  }

  await appendAppointmentVideoTimeline(input.workspaceId, input.appointmentId, {
    type: "video_meeting_created",
    label: "Transovo Video meeting created",
    detail: meetingUrl,
  });

  return { videoMeetingId: meeting.id, meetingUrl };
}

export async function ensureMeetingSessionForVideo(videoMeetingId: string) {
  const prisma = getPrisma();
  const meeting = await prisma.videoMeeting.findUnique({ where: { id: videoMeetingId } });
  if (!meeting) return null;

  const existing = await prisma.meetingSession.findFirst({
    where: { videoMeetingId: meeting.id, deletedAt: null },
  });
  if (existing) return existing;

  const meetingUrl = publicVideoMeetingUrl(meeting.publicMeetingToken);
  return prisma.meetingSession.create({
    data: {
      workspaceId: meeting.workspaceId,
      appointmentId: meeting.appointmentId,
      eventTypeId: meeting.eventTypeId,
      videoMeetingId: meeting.id,
      meetingSource: "transovo_video",
      meetingUrl,
      meetingPlatform: "transovo_video",
      title: meeting.title,
      scheduledStartAt: meeting.scheduledStartAt,
      enabled: true,
      status: "scheduled",
      recordingEnabled: meeting.recordingMode !== "off",
      transcriptEnabled: meeting.transcriptionEnabled,
      summaryEnabled: meeting.aiRecapEnabled,
      actionItemsEnabled: meeting.aiRecapEnabled,
      followUpEnabled: meeting.aiRecapEnabled,
      idempotencyKey: `video:${meeting.id}`,
    },
  });
}

export async function cancelVideoMeetingForAppointment(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  const meeting = await findVideoMeetingForAppointment(workspaceId, appointmentId);
  if (!meeting) return null;

  if (meeting.providerActiveSessionId && process.env.TELNYX_API_KEY) {
    await telnyxEndRoomSession(meeting.providerActiveSessionId).catch(() => undefined);
  }

  return prisma.videoMeeting.update({
    where: { id: meeting.id },
    data: {
      status: "canceled",
      canceledAt: new Date(),
      provisioningStatus: meeting.provisioningStatus,
    },
  });
}

export async function getPublicMeetingInfo(publicMeetingToken: string) {
  const meeting = await findVideoMeetingByToken(publicMeetingToken);
  if (!meeting) return null;

  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: meeting.workspaceId },
    select: { name: true, displayName: true, logoUrl: true },
  });

  return {
    token: meeting.publicMeetingToken,
    title: meeting.title,
    scheduledStartAt: meeting.scheduledStartAt,
    scheduledEndAt: meeting.scheduledEndAt,
    status: meeting.status,
    businessName: workspace?.displayName || workspace?.name || "Transovo",
    businessLogo: workspace?.logoUrl,
    requireGuestEmail: meeting.requireGuestEmail,
    requireGuestName: meeting.requireGuestName,
    passcodeRequired: Boolean(meeting.passcodeHash),
    recordingNotice:
      meeting.recordingMode !== "off" || meeting.transcriptionEnabled
        ? "This meeting may be recorded and transcribed."
        : null,
    chatEnabled: meeting.chatEnabled,
    guestCameraEnabled: meeting.guestCameraEnabled,
    guestMicEnabled: meeting.guestMicEnabled,
    guestScreenShare: meeting.screenSharePolicy !== "none",
    provisioningReady: meeting.provisioningStatus === "ready",
  };
}

export async function requestVideoJoin(input: {
  publicMeetingToken: string;
  displayName: string;
  email?: string;
  passcode?: string;
  userId?: string;
  isStaffHost?: boolean;
}) {
  const prisma = getPrisma();
  const meeting = await findVideoMeetingByToken(input.publicMeetingToken);
  if (!meeting) throw new JoinAccessError("not_found", "Meeting not found.");
  if (meeting.provisioningStatus !== "ready" || !meeting.providerRoomId) {
    throw new JoinAccessError("not_found", "Meeting is not ready yet. Please try again shortly.");
  }

  const role: VideoParticipantRole =
    input.isStaffHost || (input.userId && input.userId === meeting.hostUserId)
      ? "host"
      : "guest";

  const connectedCount = await prisma.videoParticipant.count({
    where: { videoMeetingId: meeting.id, state: "connected" },
  });

  let participant = await prisma.videoParticipant.findFirst({
    where: {
      videoMeetingId: meeting.id,
      OR: [
        input.userId ? { userId: input.userId } : undefined,
        input.email ? { email: input.email.toLowerCase() } : undefined,
      ].filter(Boolean) as Array<Record<string, string>>,
    },
    orderBy: { createdAt: "desc" },
  });

  const initialState =
    meeting.waitingRoomEnabled && role === "guest" ? "waiting" : "admitted";

  if (!participant) {
    participant = await prisma.videoParticipant.create({
      data: {
        videoMeetingId: meeting.id,
        workspaceId: meeting.workspaceId,
        userId: input.userId || null,
        displayName: input.displayName.trim() || "Guest",
        email: input.email?.trim().toLowerCase() || null,
        role,
        isHost: role === "host",
        state: initialState,
        requestedJoinAt: new Date(),
      },
    });
  } else {
    participant = await prisma.videoParticipant.update({
      where: { id: participant.id },
      data: {
        displayName: input.displayName.trim() || participant.displayName,
        email: input.email?.trim().toLowerCase() || participant.email,
        role,
        isHost: role === "host",
        requestedJoinAt: participant.requestedJoinAt || new Date(),
        state:
          participant.state === "removed"
            ? "removed"
            : participant.state === "connected"
              ? "connected"
              : participant.state === "admitted"
                ? "admitted"
                : meeting.waitingRoomEnabled && role === "guest" && participant.state === "waiting"
                  ? "waiting"
                  : initialState,
      },
    });
  }

  await assertJoinAccess({
    meeting,
    passcode: input.passcode,
    role,
    connectedCount,
    participantState: participant.state,
  });

  if (participant.state === "waiting") {
    return {
      waiting: true,
      participantId: participant.id,
      role,
    };
  }

  const tokenData = await telnyxGenerateJoinClientToken(meeting.providerRoomId);
  if (!tokenData?.token) {
    throw new Error("Failed to generate join credentials");
  }

  const context = buildParticipantContext({
    displayName: participant.displayName,
    transovoParticipantId: participant.id,
    role,
  });

  if (role === "host") {
    await prisma.videoMeeting.update({
      where: { id: meeting.id },
      data: {
        hostPresentAt: meeting.hostPresentAt || new Date(),
        status: meeting.status === "scheduled" ? "active" : meeting.status,
      },
    });
  }

  await prisma.videoParticipant.update({
    where: { id: participant.id },
    data: {
      state: "joining",
      admittedAt: participant.admittedAt || new Date(),
    },
  });

  return {
    waiting: false,
    participantId: participant.id,
    role,
    roomId: meeting.providerRoomId,
    clientToken: tokenData.token,
    refreshToken: tokenData.refresh_token,
    tokenTtlSecs: tokenData.token_ttl_secs,
    refreshTokenTtlSecs: tokenData.refresh_token_ttl_secs,
    context,
    settings: {
      chatEnabled: meeting.chatEnabled,
      guestScreenShare: meeting.screenSharePolicy !== "none",
      guestCamera: meeting.guestCameraEnabled,
      guestMicrophone: meeting.guestMicEnabled,
      recordingActive: meeting.recordingMode === "automatic",
      postMeetingRedirect: meeting.postMeetingRedirect,
      title: meeting.title,
      videoMeetingId: meeting.id,
    },
  };
}

async function assertVideoHost(input: {
  workspaceId: string;
  meeting: { hostUserId?: string | null; appointmentId?: string | null };
  userId: string;
  email?: string | null;
}) {
  const authorized = await isAuthorizedVideoHost(input);
  if (!authorized) throw new Error("Not authorized");
}

export async function admitVideoParticipant(input: {
  workspaceId: string;
  videoMeetingId: string;
  participantId: string;
  hostUserId: string;
  hostEmail?: string | null;
}) {
  const prisma = getPrisma();
  const meeting = await getVideoMeeting(input.workspaceId, input.videoMeetingId);
  if (!meeting) throw new Error("Meeting not found");
  await assertVideoHost({
    workspaceId: input.workspaceId,
    meeting,
    userId: input.hostUserId,
    email: input.hostEmail,
  });

  const participant = meeting.participants.find((p) => p.id === input.participantId);
  if (!participant) throw new Error("Participant not found");

  return prisma.videoParticipant.update({
    where: { id: participant.id },
    data: { state: "admitted", admittedAt: new Date() },
  });
}

export async function declineVideoParticipant(input: {
  workspaceId: string;
  videoMeetingId: string;
  participantId: string;
  hostUserId: string;
  hostEmail?: string | null;
}) {
  const prisma = getPrisma();
  const meeting = await getVideoMeeting(input.workspaceId, input.videoMeetingId);
  if (!meeting) throw new Error("Meeting not found");
  await assertVideoHost({
    workspaceId: input.workspaceId,
    meeting,
    userId: input.hostUserId,
    email: input.hostEmail,
  });

  return prisma.videoParticipant.update({
    where: { id: input.participantId },
    data: { state: "declined" },
  });
}

export async function markParticipantConnected(participantId: string, providerParticipantId?: string) {
  const prisma = getPrisma();
  const participant = await prisma.videoParticipant.update({
    where: { id: participantId },
    data: {
      state: "connected",
      joinedAt: new Date(),
      providerParticipantId: providerParticipantId || undefined,
    },
  });
  await prisma.videoMeeting.update({
    where: { id: participant.videoMeetingId },
    data: { status: "active" },
  });
  return participant;
}

export async function markParticipantLeft(participantId: string) {
  const prisma = getPrisma();
  const participant = await prisma.videoParticipant.findUnique({ where: { id: participantId } });
  if (!participant || participant.state === "left") return participant;
  const joinedAt = participant.joinedAt?.getTime();
  const durationSeconds = joinedAt
    ? Math.max(0, Math.round((Date.now() - joinedAt) / 1000))
    : null;
  return prisma.videoParticipant.update({
    where: { id: participantId },
    data: { state: "left", leftAt: new Date(), durationSeconds },
  });
}

export async function lockVideoMeeting(workspaceId: string, videoMeetingId: string) {
  const prisma = getPrisma();
  return prisma.videoMeeting.update({
    where: { id: videoMeetingId, workspaceId },
    data: { lockedAt: new Date() },
  });
}

export async function unlockVideoMeeting(workspaceId: string, videoMeetingId: string) {
  const prisma = getPrisma();
  return prisma.videoMeeting.update({
    where: { id: videoMeetingId, workspaceId },
    data: { lockedAt: null },
  });
}

async function resolveActiveSessionId(meeting: { providerActiveSessionId?: string | null; providerRoomId?: string | null }) {
  if (meeting.providerActiveSessionId) return meeting.providerActiveSessionId;
  if (!meeting.providerRoomId || !process.env.TELNYX_API_KEY) return null;
  const room = await telnyxRetrieveVideoRoom(meeting.providerRoomId).catch(() => null);
  return room?.active_session_id || null;
}

export async function moderateVideoParticipant(input: {
  workspaceId: string;
  videoMeetingId: string;
  participantId: string;
  action: "mute" | "unmute" | "remove";
  hostUserId: string;
  hostEmail?: string | null;
}) {
  const prisma = getPrisma();
  const meeting = await getVideoMeeting(input.workspaceId, input.videoMeetingId);
  if (!meeting) throw new Error("Meeting not found");
  await assertVideoHost({
    workspaceId: input.workspaceId,
    meeting,
    userId: input.hostUserId,
    email: input.hostEmail,
  });

  const target = meeting.participants.find((p) => p.id === input.participantId);
  if (!target?.providerParticipantId) throw new Error("Participant not connected");

  const sessionId = await resolveActiveSessionId(meeting);
  if (!sessionId || !process.env.TELNYX_API_KEY) {
    throw new Error("Active session unavailable");
  }

  if (input.action === "mute") {
    await telnyxMuteRoomParticipants(sessionId, [target.providerParticipantId]);
  } else if (input.action === "unmute") {
    await telnyxUnmuteRoomParticipants(sessionId, [target.providerParticipantId]);
  } else {
    await telnyxKickRoomParticipants(sessionId, [target.providerParticipantId]);
    await prisma.videoParticipant.update({
      where: { id: target.id },
      data: { state: "removed", removedAt: new Date() },
    });
  }

  return { ok: true };
}

export async function endVideoMeetingForEveryone(input: {
  workspaceId: string;
  videoMeetingId: string;
  hostUserId: string;
  hostEmail?: string | null;
}) {
  const prisma = getPrisma();
  const meeting = await getVideoMeeting(input.workspaceId, input.videoMeetingId);
  if (!meeting) throw new Error("Meeting not found");
  await assertVideoHost({
    workspaceId: input.workspaceId,
    meeting,
    userId: input.hostUserId,
    email: input.hostEmail,
  });

  const sessionId = await resolveActiveSessionId(meeting);
  if (sessionId && process.env.TELNYX_API_KEY) {
    await telnyxEndRoomSession(sessionId).catch(() => undefined);
  }

  await prisma.videoMeeting.update({
    where: { id: meeting.id },
    data: { status: "ended", endedAt: new Date() },
  });

  await finalizeVideoMeeting(meeting.id);
  return { ok: true };
}

export async function finalizeVideoMeeting(videoMeetingId: string) {
  const prisma = getPrisma();
  const meeting = await prisma.videoMeeting.findUnique({ where: { id: videoMeetingId } });
  if (!meeting) return;

  await prisma.videoMeeting.update({
    where: { id: videoMeetingId },
    data: { status: "ended", endedAt: meeting.endedAt || new Date() },
  });

  const session = await ensureMeetingSessionForVideo(videoMeetingId);
  if (session) {
    await prisma.meetingSession.update({
      where: { id: session.id },
      data: { status: "ended", endedAt: new Date() },
    });
    const { onTransovoVideoMeetingCompleted } = await import("./workflow-triggers");
    await onTransovoVideoMeetingCompleted(meeting.workspaceId, session.id, meeting.appointmentId);
  }

  if (meeting.recordingMode !== "off") {
    await enqueueVideoMeetingProcessing(videoMeetingId, meeting.workspaceId);
  } else if (meeting.transcriptionEnabled || meeting.aiRecapEnabled) {
    await enqueueVideoMeetingProcessing(videoMeetingId, meeting.workspaceId);
  }
}

export async function enqueueVideoMeetingProcessing(videoMeetingId: string, workspaceId: string) {
  await enqueueJob({
    jobType: "transovo_video_process",
    workspaceId,
    payload: { videoMeetingId },
    idempotencyKey: `video-process:${videoMeetingId}`,
  });
}

export async function persistVideoChatMessage(input: {
  videoMeetingId: string;
  workspaceId: string;
  participantId?: string;
  senderName: string;
  text: string;
}) {
  const prisma = getPrisma();
  const text = input.text.trim().slice(0, 4000);
  if (!text) return null;
  return prisma.videoChatMessage.create({
    data: {
      videoMeetingId: input.videoMeetingId,
      workspaceId: input.workspaceId,
      participantId: input.participantId,
      senderName: input.senderName.slice(0, 120),
      text,
    },
  });
}

export async function shouldProvisionTransovoVideo(input: {
  locationName?: string;
  locationKind?: string;
  eventTypeConfig?: AppointmentTypeConfig | null;
}): boolean {
  if (isTransovoVideoLocation({ kind: input.locationKind, name: input.locationName })) {
    return true;
  }
  return Boolean(input.eventTypeConfig?.transovoVideo?.enabled);
}

export async function syncVideoMeetingSchedule(input: {
  workspaceId: string;
  appointmentId: string;
  scheduledStartAt: Date;
  scheduledEndAt?: Date | null;
}) {
  const prisma = getPrisma();
  const meeting = await findVideoMeetingForAppointment(input.workspaceId, input.appointmentId);
  if (!meeting) return null;
  return prisma.videoMeeting.update({
    where: { id: meeting.id },
    data: {
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt || null,
    },
  });
}

export async function deleteVideoMeetingProviderRoom(videoMeetingId: string) {
  const prisma = getPrisma();
  const meeting = await prisma.videoMeeting.findUnique({ where: { id: videoMeetingId } });
  if (!meeting?.providerRoomId || !process.env.TELNYX_API_KEY) return;
  await telnyxDeleteVideoRoom(meeting.providerRoomId).catch(() => undefined);
  await prisma.videoMeeting.update({
    where: { id: videoMeetingId },
    data: { provisioningStatus: "deleted" },
  });
}
