"use client";

import React, { useEffect, useRef, useState } from "react";

export function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); document.removeEventListener("keydown", k); };
  }, [open]);
  return { open, setOpen, ref };
}

export function Popover({
  open, onClose, children, align = "right", width,
}: {
  open: boolean; onClose: () => void; children: React.ReactNode; align?: "left" | "right"; width?: number;
}) {
  if (!open) return null;
  return (
    <div className="tv-pop" role="menu" style={{ top: "calc(100% + 6px)", [align]: 0, width } as React.CSSProperties}
      onClick={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}
