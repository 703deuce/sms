"use client";

import { ExternalLink, Video, CalendarDays, Users, Clock3, Share2, Link2 } from "lucide-react";
import {
  MEETING_STATUS_LABELS,
  meetingPlatformLabel,
  type MeetingRow,
} from "../types";
import { StatusChip, meetingStatusTone, artifactChip } from "./status-chip";

const UPCOMING_STATUSES = new Set([
  "pending",
  "scheduled",
  "joining",
  "awaiting_admission",
  "active",
  "recording",
  "waiting",
]);

function primaryAction(row: MeetingRow) {
  const upcoming = UPCOMING_STATUSES.has(row.status);
  if (upcoming && row.meetingUrl) {
    return { label: "Open meeting", href: row.meetingUrl, external: true };
  }
  if (row.status === "completed" || row.summaryStatus === "ready") {
    return { label: "View recap", href: `/meetings/${row.id}` };
  }
  if (row.status === "processing") {
    return { label: "Processing", href: `/meetings/${row.id}` };
  }
  if (row.status === "failed" || row.summaryStatus === "failed") {
    return { label: "Retry", href: `/meetings/${row.id}` };
  }
  return { label: "View", href: `/meetings/${row.id}` };
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Time not set";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${time}`;
  if (isTomorrow) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
}

export function MeetingRowCard({
  row,
  shareToken,
  onNavigate,
  onShare,
}: {
  row: MeetingRow;
  shareToken?: string | null;
  onNavigate: (path: string) => void;
  onShare: (row: MeetingRow) => void;
}) {
  const action = primaryAction(row);
  const statusLabel = MEETING_STATUS_LABELS[row.status] || row.status;
  const isLive = row.status === "recording" || row.status === "active";
  const recChip = artifactChip(row.recordingStatus);
  const recapChip = artifactChip(row.summaryStatus);
  const actionPrimary = action.label === "View recap";
  const recapReady = row.status === "completed" || row.summaryStatus === "ready";

  return (
    <div className="meeting-row" role="article" aria-label={row.title || "Meeting"}>
      <div className="platform-icon" aria-hidden="true">
        <Video size={17} />
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <p className="meeting-title">{row.title || "Meeting"}</p>
          <StatusChip label={statusLabel} tone={meetingStatusTone(row.status)} live={isLive} />
        </div>
        <p className="meeting-meta" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <CalendarDays size={13} aria-hidden="true" />
            {formatWhen(row.scheduledStartAt)}
          </span>
          <span aria-hidden="true">·</span>
          <span>{meetingPlatformLabel(row.meetingPlatform)}</span>
          {row.durationMinutes ? (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Clock3 size={12} aria-hidden="true" />
                {row.durationMinutes} min
              </span>
            </>
          ) : null}
          {row.attendeeCount ? (
            <>
              <span aria-hidden="true">·</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Users size={12} aria-hidden="true" />
                {row.attendeeCount}
              </span>
            </>
          ) : null}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          {recChip ? <StatusChip label={`Recording: ${recChip.label}`} tone={recChip.tone} live={row.recordingStatus === "recording"} /> : null}
          {recapChip ? <StatusChip label={`Recap: ${recapChip.label}`} tone={recapChip.tone} /> : null}
          {shareToken ? (
            <span className="chip chip-info" title="A public share link is active for this recap">
              <Link2 size={11} aria-hidden="true" />
              Shared
            </span>
          ) : null}
          {row.appointmentId ? (
            <button
              type="button"
              className="link"
              style={{ fontSize: 12 }}
              onClick={() => onNavigate(`/appointments/${row.appointmentId}`)}
            >
              View appointment{row.appointmentLabel ? `: ${row.appointmentLabel}` : ""}
            </button>
          ) : null}
        </div>
      </div>

      <div className="meeting-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {recapReady ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label={`Share recap for ${row.title || "meeting"}`}
            title="Share recap"
            onClick={() => onShare(row)}
          >
            <Share2 size={14} aria-hidden="true" />
          </button>
        ) : null}
        {action.external ? (
          <a
            className="btn btn-outline btn-sm"
            href={action.href}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={14} aria-hidden="true" />
            {action.label}
          </a>
        ) : (
          <button
            type="button"
            className={`btn btn-sm ${actionPrimary ? "btn-primary" : "btn-outline"}`}
            onClick={() => onNavigate(action.href)}
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
