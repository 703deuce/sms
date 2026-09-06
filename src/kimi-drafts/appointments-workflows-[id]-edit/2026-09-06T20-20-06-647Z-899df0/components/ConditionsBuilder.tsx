"use client";

import { Plus, X } from "lucide-react";
import { CONDITION_OPTIONS, APPOINTMENT_TYPES, type WorkflowCondition } from "../mock-data";
import { SectionCard } from "./ui-primitives";

type Props = {
  logic: "and" | "or";
  conditions: WorkflowCondition[];
  onChange: (logic: "and" | "or", conditions: WorkflowCondition[]) => void;
};

const selectStyle: React.CSSProperties = {
  height: 34,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--card)",
  padding: "0 10px",
  fontSize: 13,
  outline: "none",
  color: "var(--foreground)",
};

export function ConditionsBuilder({ logic, conditions, onChange }: Props) {
  const update = (id: string, patch: Partial<WorkflowCondition>) =>
    onChange(logic, conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const remove = (id: string) => onChange(logic, conditions.filter((c) => c.id !== id));

  return (
    <SectionCard
      title="Conditions"
      subtitle="Steps only run for appointments that match these conditions. Leave empty to run for every appointment."
      action={
        conditions.length > 1 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
            <span className="text-muted-foreground">Match</span>
            <select
              aria-label="Condition match logic"
              style={{ ...selectStyle, height: 28 }}
              value={logic}
              onChange={(e) => onChange(e.target.value as "and" | "or", conditions)}
            >
              <option value="and">all conditions</option>
              <option value="or">any condition</option>
            </select>
          </div>
        ) : undefined
      }
    >
      {conditions.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: 10,
            padding: "18px 16px",
            textAlign: "center",
          }}
        >
          <p className="text-muted-foreground" style={{ fontSize: 13, margin: "0 0 10px" }}>
            No conditions — this workflow runs for every matching appointment.
          </p>
          <AddButton onClick={() => onChange(logic, [{ id: `cond_${Date.now()}`, operator: "has_phone" }])} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {conditions.map((cond, i) => {
            const opt = CONDITION_OPTIONS.find((o) => o.value === cond.operator);
            return (
              <div key={cond.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="chip chip-muted"
                  style={{ width: 40, justifyContent: "center", textTransform: "uppercase", fontSize: 10, flexShrink: 0 }}
                >
                  {i === 0 ? "If" : logic}
                </span>
                <select
                  aria-label={`Condition ${i + 1}`}
                  style={{ ...selectStyle, flex: 1, minWidth: 0 }}
                  value={cond.operator}
                  onChange={(e) => update(cond.id, { operator: e.target.value, value: undefined })}
                >
                  {CONDITION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {opt?.needsValue && (
                  <select
                    aria-label="Condition booking type"
                    style={{ ...selectStyle, flex: 1, minWidth: 0 }}
                    value={cond.value || ""}
                    onChange={(e) => update(cond.id, { value: e.target.value })}
                  >
                    <option value="">Select booking type…</option>
                    {APPOINTMENT_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => remove(cond.id)}
                  aria-label="Remove condition"
                  style={{
                    width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    borderRadius: 7, border: "none", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer", flexShrink: 0,
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
          <div>
            <AddButton onClick={() => onChange(logic, [...conditions, { id: `cond_${Date.now()}`, operator: "is_upcoming" }])} />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, height: 30, padding: "0 11px",
        borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)",
        color: "var(--foreground)", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
      }}
    >
      <Plus size={13} /> Add condition
    </button>
  );
}
