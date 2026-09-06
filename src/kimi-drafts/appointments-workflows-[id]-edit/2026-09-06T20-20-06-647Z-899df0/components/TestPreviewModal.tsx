"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { PREVIEW_RESULT } from "../mock-data";

type Props = { open: boolean; onClose: () => void };

export function TestPreviewModal({ open, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(16,24,40,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="modal-panel surface"
        style={{ width: "100%", maxWidth: 480, borderRadius: 14, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Workflow test preview"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Test preview</h3>
            <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
              Simulated against a sample appointment — no messages are sent.
            </p>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" style={{ width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: "none", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 18 }}>
          <div className="bg-muted" style={{ borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: 4 }}>
              Sample appointment
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>
              {PREVIEW_RESULT.sampleAppointment.customer} · {PREVIEW_RESULT.sampleAppointment.service}
            </div>
            <div className="text-muted-foreground" style={{ fontSize: 12.5 }}>
              {PREVIEW_RESULT.sampleAppointment.date} · {PREVIEW_RESULT.sampleAppointment.time} {PREVIEW_RESULT.sampleAppointment.timezone}
            </div>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted-foreground)", marginBottom: 8 }}>
            Scheduled steps
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {PREVIEW_RESULT.scheduledSteps.map((s) => (
              <div key={s.stepName} className="surface" style={{ borderRadius: 9, padding: "9px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.stepName}</div>
                  <div className="text-muted-foreground" style={{ fontSize: 12 }}>{s.firesAt}</div>
                </div>
                <span className="chip chip-success" style={{ flexShrink: 0 }}>Will send</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              height: 32, padding: "0 14px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--card)", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
