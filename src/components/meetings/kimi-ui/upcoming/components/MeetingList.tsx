import { Calendar, ExternalLink, FileText, Video } from "lucide-react";
import {
  formatMeetingDate,
  formatRecapDate,
  meetingPlatformLabel,
  type RecentRecap,
  type UpcomingSession,
} from "../types";
import StatusChip from "./StatusChip";

function PlatformIcon({ platform }: { platform: string }) {
  const cls =
    platform === "zoom"
      ? "platform-zoom"
      : platform === "google_meet"
      ? "platform-meet"
      : platform === "microsoft_teams"
      ? "platform-teams"
      : platform === "webex"
      ? "platform-webex"
      : platform === "transovo_video"
      ? "platform-transovo"
      : "platform-generic";
  return (
    <span className={`platform-icon ${cls}`}>
      {platform === "transovo_video" ? (
        <Video size={16} strokeWidth={2} />
      ) : (
        <Calendar size={16} strokeWidth={2} />
      )}
    </span>
  );
}

export function UpcomingList({
  sessions,
  onJoin,
}: {
  sessions: UpcomingSession[];
  onJoin: (session: UpcomingSession) => void;
}) {
  if (!sessions.length) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>
          No upcoming meetings
        </p>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted-foreground)",
            margin: "6px 0 0",
          }}
        >
          Meetings with the notetaker scheduled will appear here.
        </p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sessions.map((s) => {
        const isTransovoVideo = s.meetingPlatform === "transovo_video";
        return (
          <div key={s.id} className="card meeting-row">
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <PlatformIcon platform={s.meetingPlatform} />
              <div style={{ minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {s.title || "Meeting"}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "var(--muted-foreground)",
                    margin: "3px 0 0",
                  }}
                >
                  {meetingPlatformLabel(s.meetingPlatform)} ·{" "}
                  {formatMeetingDate(s.scheduledStartAt)}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <StatusChip status={s.status} />
              {isTransovoVideo ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => onJoin(s)}
                  aria-label={`Join video for ${s.title || "meeting"}`}
                >
                  <Video size={13} />
                  Join
                </button>
              ) : (
                <a
                  href={s.meetingUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open meeting link for ${s.title || "meeting"}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    color: "var(--muted-foreground)",
                  }}
                >
                  <ExternalLink size={15} />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RecapList({ recaps }: { recaps: RecentRecap[] }) {
  if (!recaps.length) {
    return (
      <div className="card" style={{ padding: 24, textAlign: "center" }}>
        <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>No recaps yet</p>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted-foreground)",
            margin: "6px 0 0",
          }}
        >
          When a meeting ends, Transovo prepares a recap with notes and action
          items.
        </p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {recaps.map((r) => (
        <a
          key={r.id}
          href={`/meetings/${r.id}`}
          className="card meeting-row"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <span className="platform-icon platform-generic">
              <FileText size={16} strokeWidth={2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.title || "Meeting recap"}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--muted-foreground)",
                  margin: "3px 0 0",
                }}
              >
                {meetingPlatformLabel(r.meetingPlatform)} ·{" "}
                {formatRecapDate(r.scheduledStartAt)}
              </p>
            </div>
          </div>
          <span className="chip chip-recap" style={{ flexShrink: 0 }}>
            Recap ready
          </span>
        </a>
      ))}
    </div>
  );
}
