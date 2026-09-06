"use client";

import { ArrowLeft, Copy, FlaskConical } from "lucide-react";

type Props = {
  name: string;
  enabled: boolean;
  dirty: boolean;
  saving: boolean;
  testing: boolean;
  onToggleEnabled: () => void;
  onDuplicate: () => void;
  onTest: () => void;
  onSave: () => void;
  onBack: () => void;
};

export function WorkflowHeader({
  name, enabled, dirty, saving, testing,
  onToggleEnabled, onDuplicate, onTest, onSave, onBack,
}: Props) {
  return (
    <div
      className="surface"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        borderRadius: 0,
        borderLeft: "none",
        borderRight: "none",
        borderTop: "none",
      }}
    >
      <div
        className="builder-header-inner"
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back to workflows"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 32,
            padding: "0 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--card)",
            color: "var(--muted-foreground)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <ArrowLeft size={14} /> Workflows
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 16, fontWeight: 600, margin: 0, letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
              {name || "Untitled workflow"}
            </h1>
            <span className={`chip ${enabled ? "chip-success" : "chip-muted"}`}>
              {enabled ? "Active" : "Paused"}
            </span>
            {dirty && <span className="chip chip-warning">Unsaved changes</span>}
          </div>
          <p className="text-muted-foreground" style={{ fontSize: 12, margin: "1px 0 0" }}>
            Automations → Workflows → Edit workflow
          </p>
        </div>

        <div className="builder-header-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500, color: "var(--muted-foreground)" }}>
            <button
              role="switch"
              aria-checked={enabled}
              aria-label="Workflow active"
              className="switch"
              data-on={enabled}
              onClick={onToggleEnabled}
            />
            {enabled ? "On" : "Off"}
          </label>
          <button onClick={onDuplicate} style={ghostBtn} title="Duplicate workflow">
            <Copy size={14} /> Duplicate
          </button>
          <button onClick={onTest} disabled={testing} style={{ ...ghostBtn, opacity: testing ? 0.6 : 1 }}>
            <FlaskConical size={14} /> {testing ? "Testing…" : "Test"}
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--primary)",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.6 : 1,
              boxShadow: "0 1px 2px rgba(16,24,40,0.08)",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
};
