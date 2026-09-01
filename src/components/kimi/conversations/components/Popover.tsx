"use client";
import React, { useEffect, useRef, useState } from "react";

export function Popover({ trigger, children, align = "right", width = 240, open, onOpenChange }:{
  trigger: React.ReactNode; children: React.ReactNode; align?: "left"|"right"; width?: number;
  open: boolean; onOpenChange: (v:boolean)=>void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onOpenChange]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onOpenChange]);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <div onClick={() => onOpenChange(!open)} style={{ display: "inline-flex" }}>{trigger}</div>
      {open && (
        <div className="ref-pop" style={{
          position: "absolute", top: "calc(100% + 6px)", [align]: 0, width, zIndex: 50,
          background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 10,
          boxShadow: "0 12px 32px rgba(16,24,40,.16), 0 2px 6px rgba(16,24,40,.06)", overflow: "hidden",
          animation: "tv-pop-in .12s ease-out",
          transformOrigin: align === "right" ? "top right" : "top left",
        } as React.CSSProperties}>
          {children}
        </div>
      )}
    </div>
  );
}

export function usePopover() { return useState(false); }
