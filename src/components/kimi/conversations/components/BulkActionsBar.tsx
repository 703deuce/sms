"use client";
import React from "react";
import { ChevronDown, UserCheck, Tag as TagIcon, CheckSquare } from "lucide-react";
import { Popover, usePopover } from "./Popover";
import { TAGS, TEAMMATES } from "../mock-data";

export default function BulkActionsBar({ count, onAction }:{ count: number; onAction: (a: string)=>void }) {
  const [s, setS] = usePopover(); const [a, setA] = usePopover(); const [t, setT] = usePopover(); const [m, setM] = usePopover();
  const Btn = ({ label, icon, onClick }:{ label: string; icon?: React.ReactNode; onClick?: ()=>void }) => (
    <button className="tv-btn-ghost" onClick={onClick}>{icon}{label} <ChevronDown size={13} /></button>
  );
  const MenuItem = ({ label, onClick }:{ label: string; onClick?: ()=>void }) => (
    <div onClick={onClick} style={{ padding: "7px 12px", fontSize: 13, cursor: "pointer", borderRadius: 6 }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")} onMouseLeave={(e) => (e.currentTarget.style.background = "")}>{label}</div>
  );
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, background: "#fbfcfd" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{count} Conversation{count !== 1 ? "s" : ""} Selected</div>
        <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Choose an action below.</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Popover open={s} onOpenChange={setS} align="left" width={190} trigger={<Btn label="Set Status" icon={<CheckSquare size={14} />} />}>
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "4px 8px" }}>CONVERSATION STATUS</div>
            {["Open", "Pending", "Closed"].map((x) => <MenuItem key={x} label={x} onClick={() => { onAction("status:" + x.toLowerCase()); setS(false); }} />)}
          </div>
        </Popover>
        <Popover open={a} onOpenChange={setA} align="left" width={210} trigger={<Btn label="Assign To" icon={<UserCheck size={14} />} />}>
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "4px 8px" }}>ASSIGN CONVERSATIONS</div>
            <MenuItem label="No One" onClick={() => { onAction("assign:"); setA(false); }} />
            {TEAMMATES.map((x) => <MenuItem key={x.id} label={x.name} onClick={() => { onAction("assign:" + x.id); setA(false); }} />)}
          </div>
        </Popover>
        <Popover open={t} onOpenChange={setT} align="left" width={220} trigger={<Btn label="Tag As" icon={<TagIcon size={14} />} />}>
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "4px 8px" }}>TAG CONVERSATIONS</div>
            {TAGS.map((x) => <MenuItem key={x.id} label={x.name} onClick={() => { onAction("tag:" + x.id); setT(false); }} />)}
            <div style={{ borderTop: "1px solid var(--tv-border)", marginTop: 4, paddingTop: 4 }}>
              <MenuItem label="Clear Tags" onClick={() => { onAction("tag:clear"); setT(false); }} />
            </div>
          </div>
        </Popover>
        <Popover open={m} onOpenChange={setM} align="left" width={190} trigger={<Btn label="Mark As" icon={<CheckSquare size={14} />} />}>
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", padding: "4px 8px" }}>MARK CONVERSATIONS</div>
            <MenuItem label="Unread" onClick={() => { onAction("mark:unread"); setM(false); }} />
            <MenuItem label="Read" onClick={() => { onAction("mark:read"); setM(false); }} />
          </div>
        </Popover>
      </div>
    </div>
  );
}
