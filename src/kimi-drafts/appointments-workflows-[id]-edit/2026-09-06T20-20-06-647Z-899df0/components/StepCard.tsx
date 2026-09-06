"use client";

import { ChevronDown, ChevronUp, Copy, GripVertical, Mail, MessageSquare, Phone, Trash2 } from "lucide-react";
import { describeTiming, ACTION_OPTIONS, type WorkflowStep } from "../mock-data";

type Props = {
  step: WorkflowStep;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onToggleEnabled: () => void;
};

const channelIcon = { sms: MessageSquare, email: Mail, voice: Phone };

export function StepCard({ step, index, total, expanded, onToggleExpand, onMove, onRemove, onDuplicate, onToggleEnabled }: Props) {
  const Icon = channelIcon[step.channel];
  const actionLabel = ACTION_OPTIONS.find((a) => a.value === step.action)?.label || step.action;

  return (
    <div className="fade-slide-in">
      {index > 0 && <div className="step-connector" />}
      <div
        className="surface"
        style={{
          borderRadius: expanded ? "12px 12px 0 0" : 12,
          overflow: "hidden",
          opacity: step.enabled ? 1 : 0.62,
          transition: "opacity 150ms ease",
        }}
      >
        <button
          onClick={onToggleExpand}
          aria-expanded={expanded}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <GripVertical size={15} style={{ color: "#c3c9d4", flexShrink: 0 }} />
          <span
            style={{
              width: 26, height: 26, borderRadius: 8,
              background: step.channel === "voice" ? "#f4ebff" : step.channel === "email" ? "#eff8ff" : "#eef0ff",
              color: step.channel === "voice" ? "#6941c6" : step.channel === "email" ? "#175cd3" : "var(--primary)",
              display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Icon size={13} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{step.name}</span>
              {!step.enabled && <span className="chip chip-muted">Disabled</span>}
              {step.stopIfConfirmed && <span className="chip chip-success">Skips when confirmed</span>}
            </div>
            <span className="text-muted-foreground" style={{ fontSize: 12 }}>
              {actionLabel} · {describeTiming(step.timing)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
            <IconBtn label="Move up" onClick={() => onMove(-1)} disabled={index === 0}><ChevronUp size={14} /></IconBtn>
            <IconBtn label="Move down" onClick={() => onMove(1)} disabled={index === total - 1}><ChevronDown size={14} /></IconBtn>
            <IconBtn label="Duplicate step" onClick={onDuplicate}><Copy size={13} /></IconBtn>
            <IconBtn label="Remove step" onClick={onRemove} danger><Trash2 size={13} /></IconBtn>
            <button
              role="switch"
              aria-checked={step.enabled}
              aria-label={`${step.name} enabled`}
              className="switch"
              data-on={step.enabled}
              onClick={onToggleEnabled}
              style={{ marginLeft: 6 }}
            />
          </div>
        </button>
      </div>
    </div>
  );
}

function IconBtn({ children, label, onClick, disabled, danger }: {
  children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: 7, border: "none", background: "transparent",
        color: danger ? "var(--danger)" : "var(--muted-foreground)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}
