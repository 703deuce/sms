"use client";
import React, { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, MessageSquareText, Lock, Paperclip, Smile, Braces } from "lucide-react";
import { MSG_LIMIT } from "../mock-data";

export function Toggle({ on, onChange }: { on: boolean; onChange?: (v: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`tv-toggle ${on ? "on" : ""}`}
      onClick={() => onChange?.(!on)}
    />
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="tv-toast">
      <CheckCircle2 size={18} color="#34d399" />
      {message}
    </div>
  );
}

export function MessageEditor({
  value,
  onChange,
  disabled,
  label,
}: {
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div>
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="tv-label" style={{ marginBottom: 0 }}>{label}</span>
          {disabled && <span className="text-xs tv-muted">Not Editable</span>}
        </div>
      )}
      <div className="relative">
        <textarea
          className="tv-textarea"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.value.slice(0, MSG_LIMIT))}
        />
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1">
            <button className="tv-toolbar-btn" type="button" title="Attach media"><Paperclip size={15} /></button>
            <button className="tv-toolbar-btn" type="button" title="Emoji"><Smile size={15} /></button>
            <button className="tv-toolbar-btn" type="button" title="Merge fields"><Braces size={15} /></button>
          </div>
          <div className="flex items-center gap-3">
            <span className="tv-char-count">{value.length}/{MSG_LIMIT}</span>
            <Lock size={13} className="tv-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessageAccordion({
  title,
  description,
  body,
  editable,
  open,
  onToggle,
  onChange,
}: {
  title: string;
  description: string;
  body: string;
  editable: boolean;
  open: boolean;
  onToggle: () => void;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="tv-acc">
      <button className="tv-acc-head" onClick={onToggle} type="button">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "#eef1fd" }}>
          <MessageSquareText size={15} color="#4f46e5" />
        </span>
        <span className="flex-1 text-sm font-semibold">{title}</span>
        <ChevronDown
          size={16}
          className="tv-muted"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>
      {open && (
        <div className="tv-acc-body">
          <div className="tv-info-banner mb-4">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: "#4f46e5", color: "#fff" }}>i</span>
            <span>{description}</span>
          </div>
          <MessageEditor value={body} disabled={!editable} label={title} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

export function PhonePreview({ keyword, message, footer }: { keyword?: string; message: string; footer?: string }) {
  return (
    <div>
      <div className="text-center text-xs font-semibold tv-muted mb-2">Message Preview</div>
      <div className="tv-phone">
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full" style={{ background: "#e6e8f0" }} />
        {keyword && <div className="tv-bubble-out">{keyword}</div>}
        <div className="tv-bubble-in">
          {message}
          {footer ? `\n\n${footer}` : ""}
        </div>
      </div>
    </div>
  );
}
