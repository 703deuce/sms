"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";

export default function ExportMenu({ rangeDays }: { rangeDays: number }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  function doExport(kind: "csv" | "pdf" | "email") {
    setOpen(false);
    // Production: /api/appointments/analytics/export?range=N&format=...
    if (kind === "csv") setToast(`Booking analytics (last ${rangeDays} days) exported as CSV.`);
    if (kind === "pdf") setToast(`Booking analytics report (last ${rangeDays} days) exported as PDF.`);
    if (kind === "email") setToast(`Scheduled report email for the last ${rangeDays} days.`);
  }

  return (
    <div className="export-wrap" ref={wrapRef}>
      <button
        type="button"
        className="btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Download size={15} aria-hidden="true" />
        Export
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <div className="export-menu" role="menu" aria-label="Export options">
          <button type="button" role="menuitem" onClick={() => doExport("csv")}>
            <FileSpreadsheet size={15} aria-hidden="true" />
            Export as CSV
          </button>
          <button type="button" role="menuitem" onClick={() => doExport("pdf")}>
            <FileText size={15} aria-hidden="true" />
            Export as PDF
          </button>
          <button type="button" role="menuitem" onClick={() => doExport("email")}>
            <Download size={15} aria-hidden="true" />
            Email scheduled report
          </button>
          <div className="export-note">
            Includes the last {rangeDays} days of booking metrics.
          </div>
        </div>
      ) : null}
      {toast ? (
        <div className="export-toast" role="status">
          <CheckCircle2 size={15} aria-hidden="true" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
