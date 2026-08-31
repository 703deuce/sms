"use client";
import React from "react";
import { X } from "lucide-react";

export function Modal({
  open, onClose, children, width = 560,
}: { open: boolean; onClose: () => void; children: React.ReactNode; width?: number }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center tv-fade" style={{ background: "rgba(15,23,42,.45)" }} onClick={onClose}>
      <div className="tv-pop bg-card rounded-xl shadow-2xl border border-border relative" style={{ width, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground z-10">
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/40";

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-9 h-5 rounded-full relative transition-colors ${on ? "bg-indigo-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  );
}

export function SectionRow({
  num, title, open, onToggle, children,
}: { num: number; title: string; open: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50">
        <span className={`w-5 h-5 rounded-full text-[11px] flex items-center justify-center ${open ? "bg-indigo-600 text-white" : "bg-muted text-muted-foreground"}`}>{num}</span>
        {title}
        <span className="ml-auto text-muted-foreground">{open ? "▾" : "›"}</span>
      </button>
      {open && <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">{children}</div>}
    </div>
  );
}
