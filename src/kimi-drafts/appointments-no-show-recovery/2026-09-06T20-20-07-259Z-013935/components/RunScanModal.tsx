"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export function RunScanModal({
  onClose,
  onComplete,
}: {
  onClose: () => void;
  onComplete: (found: number) => void;
}) {
  const [phase, setPhase] = useState<"confirm" | "scanning" | "done">("confirm");
  const closeRef = useRef<HTMLButtonElement>(null);
  const found = 2;

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "scanning") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  // onClick={runScan} disabled={saving} — POST { action: "scan" }
  async function runScan() {
    setPhase("scanning");
    await new Promise((r) => setTimeout(r, 1600));
    setPhase("done");
  }

  return (
    <div className="nsr-overlay" onClick={(e) => { if (e.target === e.currentTarget && phase !== "scanning") onClose(); }}>
      <div className="nsr-modal" role="dialog" aria-modal="true" aria-labelledby="nsr-scan-title" style={{ maxWidth: 460 }}>
        <div className="nsr-modal-head">
          <div>
            <div className="nsr-modal-title" id="nsr-scan-title">Run no-show scan</div>
            {phase === "confirm" && (
              <div className="nsr-modal-desc">
                Checks all appointments that ended past the grace period and haven’t been marked as completed, canceled, or no-show.
              </div>
            )}
          </div>
          <button className="nsr-modal-x" ref={closeRef} onClick={onClose} aria-label="Close dialog" disabled={phase === "scanning"}>
            <X size={16} />
          </button>
        </div>

        <div className="nsr-modal-body">
          {phase === "scanning" && (
            <div className="nsr-scan-center" aria-live="polite">
              <div className="nsr-scan-spinner" />
              <div className="nsr-scan-title">Scanning recent appointments…</div>
              <div className="nsr-scan-sub">This usually takes a few seconds.</div>
            </div>
          )}
          {phase === "done" && (
            <div className="nsr-scan-center" aria-live="polite">
              <div className="nsr-scan-result"><CheckCircle2 size={22} /></div>
              <div className="nsr-scan-title">Scan complete</div>
              <div className="nsr-scan-sub">
                {found} appointment{found === 1 ? "" : "s"} marked as no-show. Recovery follow-ups will go out on the configured schedule.
              </div>
            </div>
          )}
        </div>

        <div className="nsr-modal-foot">
          {phase === "confirm" && (
            <>
              <button className="nsr-btn nsr-btn-outline" onClick={onClose}>Cancel</button>
              <button className="nsr-btn nsr-btn-primary" onClick={runScan}>Run scan now</button>
            </>
          )}
          {phase === "done" && (
            <button className="nsr-btn nsr-btn-primary" onClick={() => onComplete(found)}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}
