"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, Clock, Plus, Users } from "lucide-react";

type Props = {
  onNewAppointment: () => void;
  onBlockTime: () => void;
  onWaitlist?: () => void;
  className?: string;
};

export function CalendarAddMenu({ onNewAppointment, onBlockTime, onWaitlist, className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className={`relative ${className || ""}`} ref={rootRef}>
      <button type="button" className="btn-primary cal-add-btn" onClick={() => setOpen((v) => !v)}>
        <Plus size={16} aria-hidden />
        Add
      </button>
      {open ? (
        <div
          className="cal-add-menu"
          role="menu"
          aria-label="Add to calendar"
        >
          <button type="button" role="menuitem" className="cal-add-menu-item" onClick={() => { setOpen(false); onNewAppointment(); }}>
            <CalendarPlus size={15} aria-hidden />
            New appointment
          </button>
          <button type="button" role="menuitem" className="cal-add-menu-item" onClick={() => { setOpen(false); onBlockTime(); }}>
            <Clock size={15} aria-hidden />
            Block time
          </button>
          {onWaitlist ? (
            <button type="button" role="menuitem" className="cal-add-menu-item" onClick={() => { setOpen(false); onWaitlist(); }}>
              <Users size={15} aria-hidden />
              Waitlist
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
