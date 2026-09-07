"use client";

import { useEffect, useState } from "react";
import { X, Link2, Trophy, MapPin, Clock, User, CalendarDays, Eye, Check } from "lucide-react";
import { MeetingPoll, STATUS_META } from "../types";
import { Button, Chip } from "./ui";

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtTimeRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt(s)} – ${fmt(e)}`;
}

/** Invitee-facing vote preview (what voters see at the shared link). */
function VotePreview({ poll }: { poll: MeetingPoll }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="vote-preview">
      <div className="vp-header">
        <Eye size={14} /> Invitees see this at your poll link
      </div>
      <div className="vp-card">
        <div className="vp-title">{poll.title}</div>
        <div className="vp-sub">
          {poll.organizer} invited you · {poll.durationMinutes} min · {poll.location}
        </div>
        {submitted ? (
          <div className="vp-thanks">
            <Check size={15} /> Thanks — your vote was recorded.
          </div>
        ) : (
          <>
            {poll.options.map((o) => (
              <label key={o.id} className="vp-option">
                <input
                  type="checkbox"
                  checked={picked.includes(o.id)}
                  onChange={(e) =>
                    setPicked((p) => (e.target.checked ? [...p, o.id] : p.filter((id) => id !== o.id)))
                  }
                />
                <span>
                  <span style={{ display: "block", fontWeight: 600 }}>{fmtDateTime(o.startsAt)}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmtTimeRange(o.startsAt, o.endsAt)} ET</span>
                </span>
              </label>
            ))}
            <Button size="sm" disabled={picked.length === 0} onClick={() => setSubmitted(true)} style={{ marginTop: 10, width: "100%" }}>
              Submit vote
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export function PollDetailDrawer({
  poll,
  onClose,
  onCopyLink,
  onBookTime,
}: {
  poll: MeetingPoll;
  onClose: () => void;
  onCopyLink: () => void;
  onBookTime: () => void;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const maxVotes = Math.max(1, ...poll.options.map((o) => o.votes));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Poll details: ${poll.title}`}>
        <div className="drawer-header">
          <div>
            <h2>{poll.title}</h2>
            <div style={{ marginTop: 8 }}>
              <Chip status={poll.status} meta={STATUS_META[poll.status]} />
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close details">
            <X size={18} />
          </button>
        </div>

        <div className="drawer-body">
          <div className="detail-grid">
            <div className="detail-item">
              <div className="dt"><Clock size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Duration</div>
              <div className="dd">{poll.durationMinutes} minutes</div>
            </div>
            <div className="detail-item">
              <div className="dt"><MapPin size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Location</div>
              <div className="dd">{poll.location}</div>
            </div>
            <div className="detail-item">
              <div className="dt"><User size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Organizer</div>
              <div className="dd">{poll.organizer}</div>
            </div>
            <div className="detail-item">
              <div className="dt"><CalendarDays size={11} style={{ marginRight: 4, verticalAlign: -1 }} />Responses</div>
              <div className="dd">{poll.responded} of {poll.invitees} invitees</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" size="sm" onClick={onCopyLink}>
              <Link2 size={14} /> Copy poll link
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowPreview((v) => !v)} aria-expanded={showPreview}>
              <Eye size={14} /> {showPreview ? "Hide voter view" : "Preview voter view"}
            </Button>
          </div>

          {showPreview && <VotePreview poll={poll} />}

          <div className="section-title">Time options</div>
          {poll.options.map((o) => {
            const isWinning = poll.winningOptionId === o.id && o.votes > 0;
            const pct = Math.round((o.votes / maxVotes) * 100);
            return (
              <div key={o.id} className={`vote-row${isWinning ? " winning" : ""}`}>
                <div className="vote-time">
                  {fmtDateTime(o.startsAt)}
                  {isWinning && (
                    <span className="win-badge"><Trophy size={11} /> {poll.status === "scheduled" ? "Booked" : "Leading"}</span>
                  )}
                </div>
                <div className="vote-sub">{fmtTimeRange(o.startsAt, o.endsAt)} ET</div>
                <div className="vote-bar">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="vote-count">{o.votes} vote{o.votes === 1 ? "" : "s"}</span>
                </div>
              </div>
            );
          })}

          {poll.status === "scheduled" && poll.winningOptionId && (
            <div className="alert" style={{ background: "var(--primary-soft)", borderColor: "#c7d2fe", color: "var(--primary)", marginTop: 16 }}>
              <div>
                <div className="alert-title">Time confirmed</div>
                The winning time was booked and calendar invites were sent to all voters.
              </div>
            </div>
          )}
          {poll.status === "closed" && (
            <div className="alert" style={{ background: "#f2f4f7", borderColor: "var(--border)", color: "var(--text-secondary)", marginTop: 16 }}>
              <div>
                <div className="alert-title">Poll closed</div>
                This poll was closed without booking a time. The voting link no longer accepts responses.
              </div>
            </div>
          )}
        </div>

        <div className="drawer-footer">
          {poll.status === "open" && (
            <Button onClick={onBookTime}>Close &amp; book time</Button>
          )}
          <Button variant={poll.status === "open" ? "outline" : "primary"} onClick={onClose}>Done</Button>
        </div>
      </aside>
    </>
  );
}
