import Link from "next/link";
import type { AppointmentMeetingIndicator } from "@/features/appointments/kimi/calendar/types";

type Props = {
  meeting?: AppointmentMeetingIndicator;
  appointmentId: string;
  eventKind?: "appointment" | "standalone_video" | "standalone_notetaker" | "external_busy";
  compact?: boolean;
};

export function CalendarMeetingBadges({
  meeting,
  appointmentId,
  eventKind = "appointment",
  compact = false,
}: Props) {
  if (!meeting) return null;

  const badges: Array<{ key: string; label: string; href?: string; tone: string }> = [];

  if (meeting.videoJoinUrl || meeting.videoStatus || meeting.videoMeetingId) {
    const canJoin =
      meeting.videoProvisioningStatus === "ready" &&
      ["scheduled", "active", "waiting"].includes(meeting.videoStatus || "");
    const hostHref =
      eventKind === "standalone_video" && meeting.videoMeetingId
        ? `/video/rooms/${meeting.videoMeetingId}/host`
        : canJoin
          ? `/appointments/${appointmentId}/video/host`
          : undefined;
    badges.push({
      key: "video",
      label: compact ? "Join" : "Join video",
      href: hostHref,
      tone: "violet",
    });
  } else if (meeting.notetakerEnabled || meeting.notetakerStatus) {
    const recapHref =
      meeting.recapReady && meeting.recapSessionId
        ? `/meetings/${meeting.recapSessionId}`
        : meeting.notetakerSessionId
          ? `/meetings/${meeting.notetakerSessionId}`
          : eventKind === "standalone_notetaker"
            ? `/meetings/${appointmentId.replace(/^meeting:/, "")}`
            : `/appointments/${appointmentId}`;
    badges.push({
      key: "notetaker",
      label: compact ? "AI" : "AI notes",
      href: recapHref,
      tone: "indigo",
    });
  }

  if (meeting.recapReady && meeting.recapSessionId) {
    badges.push({
      key: "recap",
      label: compact ? "Recap" : "View recap",
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
