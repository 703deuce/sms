"use client";
import React from "react";
import { ChevronDown, X } from "lucide-react";

export function Modal({
  open, onClose, children, width = 560,
}: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center tv-fade p-4"
      style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="tv-pop relative rounded-2xl border border-border bg-card shadow-2xl"
        style={{ width, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3.5 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={16} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground";

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 flex-none rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${on ? "bg-primary" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${on ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

export function SectionRow({
  num, title, open, onToggle, children,
}: { num: number; title: string; open: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <div className={`overflow-hidden rounded-xl border bg-card transition-all duration-150 ${open ? "border-border shadow-sm" : "border-border"}`}>
      <button
        onClick={onToggle}
        className={`flex w-full items-center gap-2.5 px-3.5 py-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted/40 ${open ? "bg-muted/30" : ""}`}
      >
        <span
          className={`flex h-5.5 w-5.5 flex-none items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          style={{ width: 22, height: 22 }}
        >
          {num}
        </span>
        {title}
        <ChevronDown
          size={14}
          className={`ml-auto text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="space-y-3.5 border-t border-border px-3.5 pb-4 pt-3.5">{children}</div>}
    </div>
  );
}
