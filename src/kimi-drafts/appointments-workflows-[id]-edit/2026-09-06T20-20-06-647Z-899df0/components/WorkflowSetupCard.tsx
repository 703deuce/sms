"use client";

import { Label } from "./ui-primitives";
import { TRIGGER_OPTIONS, APPOINTMENT_TYPES, type WorkflowRecord } from "../mock-data";

type Props = {
  workflow: WorkflowRecord;
  onChange: (patch: Partial<WorkflowRecord>) => void;
};

const inputStyle: React.CSSProperties = {
  height: 38,
  width: "100%",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--card)",
  padding: "0 12px",
  fontSize: 13,
  outline: "none",
  color: "var(--foreground)",
};

const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none", paddingRight: 32 };

export function WorkflowSetupCard({ workflow, onChange }: Props) {
  return (
    <section className="surface" style={{ borderRadius: 12, padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0, letterSpacing: "-0.01em" }}>Setup</h2>
        <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
          When this workflow runs and which appointments it applies to.
        </p>
      </div>

      <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <Label htmlFor="wf-name">Workflow name</Label>
          <input
            id="wf-name"
            style={inputStyle}
            value={workflow.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="e.g. Standard appointment reminders"
          />
        </div>
        <div>
          <Label htmlFor="wf-trigger">Trigger</Label>
          <select
            id="wf-trigger"
            style={selectStyle}
            value={workflow.trigger}
            onChange={(e) => onChange({ trigger: e.target.value })}
          >
            {TRIGGER_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Label htmlFor="wf-desc">Description</Label>
        <textarea
          id="wf-desc"
          style={{
            ...inputStyle,
            height: "auto",
            minHeight: 56,
            padding: "9px 12px",
            resize: "vertical",
            lineHeight: 1.5,
          }}
          value={workflow.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What does this workflow do?"
        />
      </div>

      <div style={{ marginTop: 14 }}>
        <Label>Applies to</Label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => onChange({ appointmentTypeScope: { mode: "all", typeIds: [] } })}
            style={scopeBtn(workflow.appointmentTypeScope.mode === "all")}
            aria-pressed={workflow.appointmentTypeScope.mode === "all"}
          >
            All booking types
          </button>
          <button
            onClick={() => onChange({ appointmentTypeScope: { mode: "selected", typeIds: workflow.appointmentTypeScope.typeIds } })}
            style={scopeBtn(workflow.appointmentTypeScope.mode === "selected")}
            aria-pressed={workflow.appointmentTypeScope.mode === "selected"}
          >
            Selected booking types
          </button>
        </div>
        {workflow.appointmentTypeScope.mode === "selected" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }} className="fade-slide-in">
            {APPOINTMENT_TYPES.map((t) => {
              const on = workflow.appointmentTypeScope.typeIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() =>
                    onChange({
                      appointmentTypeScope: {
                        mode: "selected",
                        typeIds: on
                          ? workflow.appointmentTypeScope.typeIds.filter((id) => id !== t.id)
                          : [...workflow.appointmentTypeScope.typeIds, t.id],
                      },
                    })
                  }
                  className={`chip ${on ? "chip-primary" : "chip-muted"}`}
                  style={{ height: 26, cursor: "pointer", border: "none", fontSize: 12 }}
                  aria-pressed={on}
                >
                  {t.name}
                </button>
              );
            })}
            {workflow.appointmentTypeScope.typeIds.length === 0 && (
              <span className="text-muted-foreground" style={{ fontSize: 12, alignSelf: "center" }}>
                No booking types selected — this workflow won't match any appointments.
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function scopeBtn(active: boolean): React.CSSProperties {
  return {
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    border: `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
    background: active ? "#eef0ff" : "var(--card)",
    color: active ? "var(--primary)" : "var(--muted-foreground)",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  };
}
