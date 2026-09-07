"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Link2, CheckCircle2, XCircle, Trash2, Users } from "lucide-react";
import { MeetingPoll, STATUS_META } from "../types";
import { Chip } from "./ui";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function PollRow({
  poll,
  onOpen,
  onCopyLink,
  onBookTime,
  onClosePoll,
  onDelete,
}: {
  poll: MeetingPoll;
  onOpen: () => void;
  onCopyLink: () => void;
  onBookTime: () => void;
  onClosePoll: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const clickHandler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", clickHandler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", clickHandler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [menuOpen]);

  const pct = poll.invitees > 0 ? Math.round((poll.responded / poll.invitees) * 100) : 0;

  return (
    <tr onClick={onOpen}>
      <td>
        <div className="poll-title-cell">{poll.title}</div>
        <div className="poll-meta">
          Created {fmtDate(poll.createdAt)} · {poll.durationMinutes} min · {poll.location}
        </div>
      </td>
      <td className="hide-sm">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Users size={13} /> {poll.responded}/{poll.invitees}
          </span>
        </div>
      </td>
      <td>
        <Chip status={poll.status} meta={STATUS_META[poll.status]} />
      </td>
      <td style={{ textAlign: "right", position: "relative" }} onClick={(e) => e.stopPropagation()}>
        <div ref={menuRef} style={{ display: "inline-block", position: "relative" }}>
          <button
            className="icon-btn"
            aria-label={`More actions for ${poll.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal size={17} />
          </button>
          {menuOpen && (
            <div className="row-menu" role="menu" aria-label={`Actions for ${poll.title}`}>
              <button role="menuitem" onClick={() => { setMenuOpen(false); onOpen(); }}>
                <Users size={14} /> View votes
              </button>
              <button role="menuitem" onClick={() => { setMenuOpen(false); onCopyLink(); }}>
                <Link2 size={14} /> Copy poll link
              </button>
              {poll.status === "open" && (
                <>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); onBookTime(); }}>
                    <CheckCircle2 size={14} /> Close &amp; book time
                  </button>
                  <button role="menuitem" onClick={() => { setMenuOpen(false); onClosePoll(); }}>
                    <XCircle size={14} /> Close without booking
                  </button>
                </>
              )}
              <button role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onDelete(); }}>
                <Trash2 size={14} /> Delete poll
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
