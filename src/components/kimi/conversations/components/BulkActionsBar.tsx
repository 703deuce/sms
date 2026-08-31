"use client";
import React from "react";
import { ChevronDown, UserCheck, Tag as TagIcon, CheckSquare, ListChecks } from "lucide-react";
import { Popover, usePopover } from "./Popover";
import { TAGS, TEAMMATES, type Tag, type Teammate } from "../mock-data";

export default function BulkActionsBar({ count, onAction, tags, teammates }:{
  count: number; onAction: (a: string)=>void; tags?: Tag[]; teammates?: Teammate[];
}) {
  const tagList = tags ?? TAGS;
  const teammateList = teammates ?? TEAMMATES;
  const [s, setS] = usePopover(); const [a, setA] = usePopover(); const [t, setT] = usePopover(); const [m, setM] = usePopover();
  const Btn = ({ label, icon, onClick }:{ label: string; icon?: React.ReactNode; onClick?: ()=>void }) => (
    <button className="tv-btn-ghost" onClick={onClick}>{icon}{label} <ChevronDown size={13} /></button>
  );
  const MenuItem = ({ label, onClick }:{ label: string; onClick?: ()=>void }) => (
    <div className="tv-menu-item" onClick={onClick}>{label}</div>
  );
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, background: "var(--tv-panel)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <span style={{ width: 52, height: 52, borderRadius: 9999, background: "var(--tv-primary-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <ListChecks size={24} color="var(--tv-primary)" strokeWidth={1.8} />
        </span>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.1 }}>{count} Conversation{count !== 1 ? "s" : ""} Selected</div>
          <div style={{ fontSize: 12.5, color: "var(--tv-faint)", marginTop: 3 }}>Choose an action below.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <Popover open={s} onOpenChange={setS} align="left" width={190} trigger={<Btn label="Set Status" icon={<CheckSquare size={14} />} />}>
          <div style={{ padding: 6 }}>
            <div className="tv-menu-label">CONVERSATION STATUS</div>
            {["Open", "Pending", "Closed"].map((x) => <MenuItem key={x} label={x} onClick={() => { onAction("status:" + x.toLowerCase()); setS(false); }} />)}
          </div>
        </Popover>
        <Popover open={a} onOpenChange={setA} align="left" width={210} trigger={<Btn label="Assign To" icon={<UserCheck size={14} />} />}>
          <div style={{ padding: 6 }}>
            <div className="tv-menu-label">ASSIGN CONVERSATIONS</div>
            <MenuItem label="No One" onClick={() => { onAction("assign:"); setA(false); }} />
            {teammateList.map((x) => <MenuItem key={x.id} label={x.name} onClick={() => { onAction("assign:" + x.id); setA(false); }} />)}
          </div>
        </Popover>
        <Popover open={t} onOpenChange={setT} align="left" width={220} trigger={<Btn label="Tag As" icon={<TagIcon size={14} />} />}>
          <div style={{ padding: 6 }}>
            <div className="tv-menu-label">TAG CONVERSATIONS</div>
            {tagList.map((x) => <MenuItem key={x.id} label={x.name} onClick={() => { onAction("tag:" + x.id); setT(false); }} />)}
            <div className="tv-menu-sep">
              <MenuItem label="Clear Tags" onClick={() => { onAction("tag:clear"); setT(false); }} />
            </div>
          </div>
        </Popover>
        <Popover open={m} onOpenChange={setM} align="left" width={190} trigger={<Btn label="Mark As" icon={<CheckSquare size={14} />} />}>
          <div style={{ padding: 6 }}>
            <div className="tv-menu-label">MARK CONVERSATIONS</div>
            <MenuItem label="Unread" onClick={() => { onAction("mark:unread"); setM(false); }} />
            <MenuItem label="Read" onClick={() => { onAction("mark:read"); setM(false); }} />
          </div>
        </Popover>
      </div>
    </div>
  );
}
