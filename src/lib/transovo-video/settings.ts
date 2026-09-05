import "server-only";

import { getPrisma } from "@/lib/db";
import {
  DEFAULT_TRANSOVO_VIDEO_CONFIG,
  type EventTypeVideoConfig,
  type TransovoVideoPlatformConfig,
} from "./types";

export const TRANSOVO_VIDEO_SOLUTION_TYPE = "transovo-video";

export async function loadTransovoVideoConfig(
  workspaceId: string,
): Promise<TransovoVideoPlatformConfig> {
  const prisma = getPrisma();
  const row = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: TRANSOVO_VIDEO_SOLUTION_TYPE },
    orderBy: { updatedAt: "desc" },
  });
  const stored = (row?.configJson || {}) as Partial<TransovoVideoPlatformConfig>;
  return { ...DEFAULT_TRANSOVO_VIDEO_CONFIG, ...stored };
}

export async function saveTransovoVideoConfig(
  workspaceId: string,
  patch: Partial<TransovoVideoPlatformConfig>,
): Promise<TransovoVideoPlatformConfig> {
  const prisma = getPrisma();
  const current = await loadTransovoVideoConfig(workspaceId);
  const next = { ...current, ...patch };

  const existing = await prisma.solutionSetup.findFirst({
    where: { workspaceId, solutionType: TRANSOVO_VIDEO_SOLUTION_TYPE },
  });

  if (existing) {
    await prisma.solutionSetup.update({
      where: { id: existing.id },
      data: { configJson: next as object, status: "ACTIVE", name: "Transovo Video" },
    });
  } else {
    await prisma.solutionSetup.create({
      data: {
        workspaceId,
        solutionType: TRANSOVO_VIDEO_SOLUTION_TYPE,
        name: "Transovo Video",
        status: "ACTIVE",
        configJson: next as object,
        externalKey: `transovo-video:${workspaceId}`,
      },
    });
  }

  return next;
}

export function resolveEventTypeVideoConfig(
  platform: TransovoVideoPlatformConfig,
  eventType?: EventTypeVideoConfig | null,
): EventTypeVideoConfig {
  return {
    enabled: eventType?.enabled ?? true,
    maxParticipants: eventType?.maxParticipants ?? platform.defaultMaxParticipants ?? 10,
    requireHost: eventType?.requireHost ?? platform.requireHost ?? false,
    requireGuestName: eventType?.requireGuestName ?? false,
    requireGuestEmail: eventType?.requireGuestEmail ?? platform.requireGuestEmail ?? true,
    requirePasscode: eventType?.requirePasscode ?? false,
    passcode: eventType?.passcode,
    waitingRoom: eventType?.waitingRoom ?? platform.waitingRoom ?? false,
    guestCamera: eventType?.guestCamera ?? true,
    guestMicrophone: eventType?.guestMicrophone ?? true,
    guestScreenShare: eventType?.guestScreenShare ?? platform.guestScreenShare ?? true,
    guestChat: eventType?.guestChat ?? platform.guestChat ?? true,
    recordingMode: eventType?.recordingMode ?? platform.defaultRecordingMode ?? "off",
    transcription: eventType?.transcription ?? platform.defaultTranscription ?? false,
    aiRecap: eventType?.aiRecap ?? platform.defaultAiRecap ?? false,
    actionItems: eventType?.actionItems ?? platform.defaultActionItems ?? false,
    followUp: eventType?.followUp ?? platform.defaultFollowUp ?? false,
    postMeetingRedirect:
      eventType?.postMeetingRedirect ?? platform.defaultPostMeetingRedirect ?? null,
  };
}
