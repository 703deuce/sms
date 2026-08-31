"use client";
import { useState } from "react";
import { ChevronDown, Info, Lock, Paperclip, Smile, Braces } from "lucide-react";
import type { AutoReplyMessage } from "../mock-data";

export default function MessageAccordion({
  msg,
  value,
  onChange,
  defaultOpen = false,
}: {
  msg: AutoReplyMessage;
  value: string;
  onChange?: (v: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const limit = 918;

  return (
    <div className={`tv-acc ${open ? "open" : ""}`}>
      <button className="tv-acc-head" onClick={() => setOpen(!open)}>
        {msg.locked ? <Lock size={15} className="lock-ic" /> : <Paperclip size={15} className="lock-ic" />}
        {msg.title}
        <ChevronDown size={16} className="chev" />
      </button>
      {open && (
        <div className="tv-acc-body">
          <div className="tv-info">
            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{msg.description}</span>
          </div>
          <div className="tv-label-row">
            <span>{msg.title}</span>
            {msg.editable ? (
              <span>{value.length}/{limit}</span>
            ) : (
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Lock size={11} /> Not Editable
              </span>
            )}
          </div>
          <textarea
            className="tv-textarea"
            readOnly={!msg.editable}
            value={value}
            maxLength={limit}
            onChange={(e) => onChange?.(e.target.value)}
          />
          {msg.editable && (
            <div className="tv-toolbar">
              <button className="tv-tool-btn" title="Attach media"><Paperclip size={14} /></button>
              <button className="tv-tool-btn" title="Emoji"><Smile size={14} /></button>
              <button className="tv-tool-btn" title="Merge fields"><Braces size={14} /></button>
              <span className="tv-tool-right tv-tool-btn" title="Compliance appended automatically"><Lock size={13} /></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
