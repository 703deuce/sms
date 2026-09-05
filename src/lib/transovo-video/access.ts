import "server-only";

import type { VideoMeeting } from "@prisma/client";
import {
  TELNYX_VIDEO_MAX_PARTICIPANTS,
  type VideoParticipantRole,
} from "./types";
import { verifyMeetingPasscode } from "./tokens";

export type JoinAccessErrorCode =
  | "not_found"
  | "canceled"
  | "too_early"
  | "too_late"
  | "locked"
  | "passcode_required"
  | "passcode_invalid"
  | "host_required"
  | "room_full"
  | "waiting_room"
  | "removed";

export class JoinAccessError extends Error {
  code: JoinAccessErrorCode;
  constructor(code: JoinAccessErrorCode, message: string) {
    super(message);
    this.name = "JoinAccessError";
    this.code = code;
  }
}

export function effectiveMaxParticipants(meeting: {
  maxParticipants: number;
  workspacePlanMax?: number;
}): number {
  const planMax = meeting.workspacePlanMax ?? TELNYX_VIDEO_MAX_PARTICIPANTS;
  return Math.min(TELNYX_VIDEO_MAX_PARTICIPANTS, planMax, meeting.maxParticipants);
}

export function isWithinJoinWindow(
  meeting: Pick<
    VideoMeeting,
    "scheduledStartAt" | "scheduledEndAt" | "joinWindowMinutesBefore" | "joinWindowMinutesAfter"
  >,
  now = new Date(),
): { ok: true } | { ok: false; code: "too_early" | "too_late" } {
  if (!meeting.scheduledStartAt) return { ok: true };
  const start = meeting.scheduledStartAt.getTime();
  const end = meeting.scheduledEndAt?.getTime() ?? start + 60 * 60_000;
  const earliest = start - (meeting.joinWindowMinutesBefore || 15) * 60_000;
  const latest = end + (meeting.joinWindowMinutesAfter || 30) * 60_000;
  if (now.getTime() < earliest) return { ok: false, code: "too_early" };
  if (now.getTime() > latest) return { ok: false, code: "too_late" };
  return { ok: true };
}

export async function assertJoinAccess(input: {
  meeting: VideoMeeting;
  passcode?: string;
  role: VideoParticipantRole;
  connectedCount: number;
  participantState?: string;
  workspacePlanMax?: number;
}): Promise<void> {
  const { meeting } = input;

  if (meeting.status === "canceled" || meeting.canceledAt) {
    throw new JoinAccessError("canceled", "This meeting was canceled.");
  }
  if (meeting.status === "ended" || meeting.endedAt) {
    throw new JoinAccessError("too_late", "This meeting has ended.");
  }
  if (meeting.lockedAt && input.role === "guest") {
    throw new JoinAccessError("locked", "The host has locked this meeting.");
  }

  const window = isWithinJoinWindow(meeting);
  if (!window.ok) {
    throw new JoinAccessError(
      window.code,
      window.code === "too_early"
        ? "This meeting isn't open yet."
        : "This meeting has ended.",
    );
  }

  if (meeting.passcodeHash) {
    if (!input.passcode) {
      throw new JoinAccessError("passcode_required", "Meeting passcode is required.");
    }
    const valid = await verifyMeetingPasscode(input.passcode, meeting.passcodeHash);
    if (!valid) {
      throw new JoinAccessError("passcode_invalid", "Invalid meeting passcode.");
    }
  }

  if (meeting.requireHost && input.role === "guest" && !meeting.hostPresentAt) {
    throw new JoinAccessError(
      "host_required",
      "Waiting for the host to start the meeting.",
    );
  }

  if (
    meeting.waitingRoomEnabled &&
    input.role === "guest" &&
    input.participantState === "waiting"
  ) {
    throw new JoinAccessError("waiting_room", "Waiting for host approval.");
  }

  if (input.participantState === "removed") {
    throw new JoinAccessError("removed", "You were removed from the meeting.");
  }

  const max = effectiveMaxParticipants({
    maxParticipants: meeting.maxParticipants,
    workspacePlanMax: input.workspacePlanMax,
  });
  if (input.connectedCount >= max && input.participantState !== "connected") {
    throw new JoinAccessError("room_full", "This meeting has reached its participant limit.");
  }
}
