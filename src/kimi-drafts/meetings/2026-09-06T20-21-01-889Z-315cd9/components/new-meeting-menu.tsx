"use client";

import { Plus, Sparkles, CalendarClock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function NewMeetingMenu({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function go(path: string) {
    setOpen(false);
    onNavigate(path);
  }

  return (
    <div className="menu-wrap" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-primary btn-sm"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus size={15} aria-hidden="true" />
        New meeting
      </button>
      {open ? (
        <div className="menu-pop" role="menu" aria-label="New meeting options">
          <button type="button" role="menuitem" className="menu-item" onClick={() => go("/video?mode=add")}>
            <span className="menu-item-icon"><Sparkles size={14} aria-hidden="true" /></span>
            <span>
              <span className="menu-item-title">Add AI Notetaker now</span>
              <span className="menu-item-desc" style={{ display: "block" }}>
                Paste a live Zoom, Meet, Teams, or Webex link.
              </span>
            </span>
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={() => go("/video?mode=schedule")}>
            <span className="menu-item-icon"><CalendarClock size={14} aria-hidden="true" /></span>
            <span>
              <span className="menu-item-title">Schedule AI Notetaker</span>
              <span className="menu-item-desc" style={{ display: "block" }}>
                Have the notetaker join a future meeting automatically.
              </span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
