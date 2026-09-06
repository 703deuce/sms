"use client";

import { X } from "lucide-react";
import { describeTiming, triggerLabel, type WorkflowStep } from "../mock-data";

type Props = {
  name: string;
  trigger: string;
  steps: WorkflowStep[];
  onClose: () => void;
};

export default function TestPreviewModal({ name, trigger, steps, onClose }: Props) {
  const active = steps.filter((s) => s.enabled);
  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Workflow preview"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h3>Preview — {name || "Untitled workflow"}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close preview"><X size={16} /></button>
        </div>
        <div className="modal-body">
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--text-secondary)" }}>
            When <strong>{triggerLabel(trigger)}</strong> occurs for an appointment in scope,{" "}
            {active.length === 0
              ? "no steps will run — every step is disabled."
              : `${active.length} step${active.length === 1 ? "" : "s"} will run:`}
          </p>
          {active.map((s, i) => (
            <div className="preview-row" key={s.id}>
              <span className="p-num">{i + 1}</span>
              <div>
                <div className="p-when">{describeTiming(s.timing)}</div>
                <div className="p-what">
                  {s.name || `Step ${i + 1}`} · {s.channel.toUpperCase()}
                  {s.stopIfConfirmed ? " · skipped if confirmed" : ""}
                </div>
                {s.messageTemplate ? <div className="p-msg">{s.messageTemplate}</div> : null}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
