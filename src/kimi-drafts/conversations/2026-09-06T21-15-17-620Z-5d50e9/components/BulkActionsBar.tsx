"use client";

import React from "react";
import { Check, ChevronDown, MailOpen, EyeOff, Users } from "lucide-react";
import type { Tag, Teammate } from "../mock-data";
import { Popover, usePopover } from "./Popover";

export function BulkActionsBar({
  count, tags, teammates, onAction, onClear,
}: {
  count: number; tags: Tag[]; teammates: Teammate[];
  onAction: (a: string) => void; onClear: () => void;
}) {
  const s = usePopover(); const a = usePopover(); const t = usePopover(); const m = usePopover();
  return (
    <div className="tv-bulk" role="region" aria-label="Bulk actions">
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, textAlign: "center" }}>{count} Conversation{count === 1 ? "" : "s"} Selected</p>
        <p style={{ fontSize: 12.5, color: "var(--tv-muted)", textAlign: "center", marginTop: 4 }}>Choose an action below.</p>
      </div>
      <div className="tv-bulk-actions">
        <div style={{ position: "relative" }} ref={s.ref}>
          <button type="button" className="tv-btn" onClick={() => s.setOpen(!s.open)} aria-expanded={s.open}>
            Set Status <ChevronDown size={13} />
          </button>
          <Popover open={s.open} onClose={() => s.setOpen(false)} align="left" width={180}>
            <div className="tv-pop-label">Conversation status</div>
            {["Open", "Pending", "Closed"].map((x) => (
              <button key={x} type="button" className="tv-pop-item" onClick={() => { onAction("status:" + x.toLowerCase()); s.setOpen(false); }}>{x}</button>
            ))}
          </Popover>
        </div>

        <div style={{ position: "relative" }} ref={a.ref}>
          <button type="button" className="tv-btn" onClick={() => a.setOpen(!a.open)} aria-expanded={a.open}>
            <Users size={13} /> Assign To <ChevronDown size={13} />
          </button>
          <Popover open={a.open} onClose={() => a.setOpen(false)} align="left" width={210}>
            <div className="tv-pop-label">Assign conversation</div>
            <button type="button" className="tv-pop-item" onClick={() => { onAction("assign:"); a.setOpen(false); }}>No One</button>
            {teammates.map((x) => (
              <button key={x.id} type="button" className="tv-pop-item" onClick={() => { onAction("assign:" + x.id); a.setOpen(false); }}>
                <span className="tv-avatar" style={{ width: 20, height: 20, fontSize: 8.5 }}>{x.initials}</span> {x.name}
              </button>
            ))}
          </Popover>
        </div>

        <div style={{ position: "relative" }} ref={t.ref}>
          <button type="button" className="tv-btn" onClick={() => t.setOpen(!t.open)} aria-expanded={t.open}>
            Tag As <ChevronDown size={13} />
          </button>
          <Popover open={t.open} onClose={() => t.setOpen(false)} align="left" width={210}>
            <div className="tv-pop-label">Tag conversations</div>
            {tags.map((x) => (
              <button key={x.id} type="button" className="tv-pop-item" onClick={() => { onAction("tag:" + x.id); t.setOpen(false); }}>
                <span className="tv-tagdot" style={{ background: x.color }} /> {x.name}
              </button>
            ))}
            <button type="button" className="tv-pop-item" style={{ color: "var(--tv-red)" }} onClick={() => { onAction("tag:clear"); t.setOpen(false); }}>Clear Tags</button>
          </Popover>
        </div>

        <div style={{ position: "relative" }} ref={m.ref}>
          <button type="button" className="tv-btn" onClick={() => m.setOpen(!m.open)} aria-expanded={m.open}>
            Mark As <ChevronDown size={13} />
          </button>
          <Popover open={m.open} onClose={() => m.setOpen(false)} align="left" width={180}>
            <div className="tv-pop-label">Mark conversations</div>
            <button type="button" className="tv-pop-item" onClick={() => { onAction("mark:unread"); m.setOpen(false); }}><EyeOff size={13} style={{ color: "var(--tv-muted)" }} /> Unread</button>
            <button type="button" className="tv-pop-item" onClick={() => { onAction("mark:read"); m.setOpen(false); }}><MailOpen size={13} style={{ color: "var(--tv-muted)" }} /> Read</button>
          </Popover>
        </div>
      </div>
      <button type="button" className="tv-btn sm" onClick={onClear}>
        <Check size={12} /> Clear selection
      </button>
    </div>
  );
}
