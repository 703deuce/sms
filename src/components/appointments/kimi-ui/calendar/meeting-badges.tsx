import Link from "next/link";
import type { AppointmentMeetingIndicator } from "@/features/appointments/kimi/calendar/types";
import { MEETING_STATUS_LABELS } from "@/lib/meeting-assistant/types";
import { VIDEO_STATUS_LABELS } from "@/lib/transovo-video/types";

function labelForNotetaker(status?: string | null) {
  if (!status) return "Notetaker";
  return MEETING_STATUS_LABELS[status as keyof typeof MEETING_STATUS_LABELS] || status;
}

function labelForVideo(status?: string | null) {
  if (!status) return "Video";
  return VIDEO_STATUS_LABELS[status as keyof typeof VIDEO_STATUS_LABELS] || status;
}

type Props = {
  meeting?: AppointmentMeetingIndicator;
  appointmentId: string;
  compact?: boolean;
};

export function CalendarMeetingBadges({ meeting, appointmentId, compact = false }: Props) {
  if (!meeting) return null;

  const badges: Array<{ key: string; label: string; href?: string; tone: string }> = [];

  if (meeting.notetakerEnabled || meeting.notetakerStatus) {
    badges.push({
      key: "notetaker",
      label: compact ? "AI" : labelForNotetaker(meeting.notetakerStatus),
      tone: "indigo",
    });
  }

  if (meeting.videoJoinUrl || meeting.videoStatus) {
    const canJoin =
      meeting.videoProvisioningStatus === "ready" &&
      ["scheduled", "active", "waiting"].includes(meeting.videoStatus || "");
    badges.push({
      key: "video",
      label: compact ? "Video" : labelForVideo(meeting.videoStatus),
      href: canJoin ? `/appointments/${appointmentId}/video/host` : undefined,
      tone: "violet",
    });
  }

  if (meeting.recapReady && meeting.recapSessionId) {
    badges.push({
      key: "recap",
      label: compact ? "Recap" : "Recap ready",
      href: `/meetings/${meeting.recapSessionId}`,
      tone: "green",
    });
  }

  if (!badges.length) return null;

  return (
    <div className={`cal-meeting-badges ${compact ? "compact" : ""}`}>
      {badges.map((badge) =>
        badge.href ? (
          <Link key={badge.key} href={badge.href} className={`cal-meeting-badge tone-${badge.tone}`}>
            {badge.label}
          </Link>
        ) : (
          <span key={badge.key} className={`cal-meeting-badge tone-${badge.tone}`}>
            {badge.label}
          </span>
        ),
      )}
    </div>
  );
}
