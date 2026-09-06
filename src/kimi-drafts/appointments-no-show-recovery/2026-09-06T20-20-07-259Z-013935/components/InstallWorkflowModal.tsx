"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Workflow, X } from "lucide-react";
import { workflowTemplate } from "../mock-data";

export function InstallWorkflowModal({
  onClose,
  onInstalled,
}: {
  onClose: () => void;
  onInstalled: () => void;
}) {
  const [installing, setInstalling] = useState(false);
  const [done, setDone] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !installing) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, installing]);

  // onClick={installWorkflow} disabled={saving} — POST { action: "install-workflow" }
  async function installWorkflow() {
    setInstalling(true);
    await new Promise((r) => setTimeout(r, 900));
    setInstalling(false);
    setDone(true);
    window.setTimeout(onInstalled, 900);
  }

  return (
    <div className="nsr-overlay" onClick={(e) => { if (e.target === e.currentTarget && !installing) onClose(); }}>
      <div className="nsr-modal" role="dialog" aria-modal="true" aria-labelledby="nsr-install-title">
        <div className="nsr-modal-head">
          <div>
            <div className="nsr-modal-title" id="nsr-install-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Workflow size={17} style={{ color: "var(--accent)" }} /> Install no-show recovery workflow
            </div>
            <div className="nsr-modal-desc">
              Review the prebuilt template. It becomes active immediately after install and applies to every booking type.
            </div>
          </div>
          <button className="nsr-modal-x" ref={closeRef} onClick={onClose} aria-label="Close dialog" disabled={installing}>
            <X size={16} />
          </button>
        </div>

        <div className="nsr-modal-body">
          {done ? (
            <div className="nsr-scan-center">
              <div className="nsr-scan-result"><CheckCircle2 size={22} /></div>
              <div className="nsr-scan-title">Workflow installed</div>
              <div className="nsr-scan-sub">No-show recovery is now active for all booking types.</div>
            </div>
          ) : (
            <>
              <div className="nsr-step">
                <span className="nsr-step-num">
                  <Workflow size={11} />
                </span>
                <div>
                  <div className="nsr-step-timing">Trigger</div>
                  <div className="nsr-step-action">{workflowTemplate.trigger}</div>
                </div>
              </div>
              {workflowTemplate.steps.map((s, i) => (
                <div className="nsr-step" key={i}>
                  <span className="nsr-step-num">{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div className="nsr-step-timing">{s.timing}</div>
                    <div className="nsr-step-action">{s.action}</div>
                    <div className="nsr-step-preview">{s.preview}</div>
                  </div>
                </div>
              ))}
              <div className="nsr-help" style={{ marginTop: 10 }}>
                Follow-ups stop automatically if the customer replies, rebooks, or has opted out of texts. You can edit this workflow later under Automations → Workflows.
              </div>
            </>
          )}
        </div>

        {!done && (
          <div className="nsr-modal-foot">
            <button className="nsr-btn nsr-btn-outline" onClick={onClose} disabled={installing}>Cancel</button>
            <button className="nsr-btn nsr-btn-primary" onClick={installWorkflow} disabled={installing}>
              {installing && <Loader2 size={14} style={{ animation: "nsrSpin .8s linear infinite" }} />}
              {installing ? "Installing…" : "Install workflow"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
