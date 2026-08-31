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
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open && (
        <div className="ref-pop" style={{
          position: "absolute", top: "calc(100% + 6px)", [align]: 0, width, zIndex: 50,
          background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,.12)", overflow: "hidden",
        } as React.CSSProperties}>
          {children}
        </div>
      )}
    </div>
  );
}

export function usePopover() { return useState(false); }
