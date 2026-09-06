import { Plus, Trash2 } from "lucide-react";
import type { RoutingForm, RoutingFormRule, RoutingDestination } from "../mock-data";
import { bookingTypes, staffMembers } from "../mock-data";

type Props = {
  form: RoutingForm;
  onChange: (form: RoutingForm) => void;
};

const operators = [
  { value: "equals", label: "equals" },
  { value: "contains", label: "contains" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "in", label: "is one of" },
] as const;

function destValue(d: RoutingDestination): string {
  if (d.staffId) return `staff:${d.staffId}`;
  if (d.externalUrl !== undefined && d.externalUrl !== "") return `url:${d.externalUrl}`;
  if (d.externalUrl !== undefined && !d.appointmentTypeId) return "url:";
  return d.appointmentTypeId || "";
}

function parseDest(val: string): RoutingDestination {
  if (val.startsWith("staff:")) return { staffId: val.slice(6) };
  if (val.startsWith("url:")) return { externalUrl: val.slice(4) };
  if (val) return { appointmentTypeId: val };
  return {};
}

export default function RuleEditor({ form, onChange }: Props) {
  function updateRule(ri: number, patch: Partial<RoutingFormRule>) {
    const rules = form.rules.map((r, i) => (i === ri ? { ...r, ...patch } : r));
    onChange({ ...form, rules });
  }

  function updateCondition(ri: number, ci: number, patch: Partial<RoutingFormRule["conditions"][number]>) {
    const rules = form.rules.map((r, i) =>
      i === ri
        ? { ...r, conditions: r.conditions.map((c, j) => (j === ci ? { ...c, ...patch } : c)) }
        : r,
    );
    onChange({ ...form, rules });
  }

  function addCondition(ri: number) {
    const firstField = form.fields[0]?.id || "";
    const rules = form.rules.map((r, i) =>
      i === ri
        ? { ...r, conditions: [...r.conditions, { fieldId: firstField, operator: "equals" as const, value: "" }] }
        : r,
    );
    onChange({ ...form, rules });
  }

  function removeCondition(ri: number, ci: number) {
    const rules = form.rules.map((r, i) =>
      i === ri ? { ...r, conditions: r.conditions.filter((_, j) => j !== ci) } : r,
    );
    onChange({ ...form, rules });
  }

  function addRule() {
    const firstField = form.fields[0]?.id || "";
    onChange({
      ...form,
      rules: [
        ...form.rules,
        {
          id: `rule_${Date.now()}`,
          priority: form.rules.length + 1,
          logic: "and",
          conditions: [{ fieldId: firstField, operator: "equals", value: "" }],
          destination: {},
        },
      ],
    });
  }

  function removeRule(ri: number) {
    onChange({ ...form, rules: form.rules.filter((_, i) => i !== ri) });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <h3 className="font-display" style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Routing rules</h3>
          <p className="text-muted-foreground" style={{ fontSize: 12.5, margin: "2px 0 0" }}>
            Rules are evaluated in order. First match wins.
          </p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={addRule}>
          <Plus size={14} /> Add rule
        </button>
      </div>

      {form.rules.length === 0 ? (
        <div
          className="text-muted-foreground"
          style={{ border: "1px dashed hsl(var(--border))", borderRadius: 10, padding: 20, textAlign: "center", fontSize: 13 }}
        >
          No rules yet. All submissions will use the fallback destination.
        </div>
      ) : (
        form.rules.map((rule, ri) => (
          <div key={rule.id} className="rule-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>Rule {ri + 1}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {rule.conditions.length > 1 && (
                  <select
                    className="input"
                    style={{ width: 110, height: 30, fontSize: 12.5 }}
                    value={rule.logic || "and"}
                    onChange={(e) => updateRule(ri, { logic: e.target.value as "and" | "or" })}
                    aria-label="Condition logic"
                  >
                    <option value="and">Match all</option>
                    <option value="or">Match any</option>
                  </select>
                )}
                <button className="btn btn-ghost btn-icon" onClick={() => removeRule(ri)} aria-label="Delete rule">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {rule.conditions.map((cond, ci) => {
              const field = form.fields.find((f) => f.id === cond.fieldId);
              return (
                <div key={ci} className="condition-row">
                  <select
                    className="input"
                    value={cond.fieldId}
                    onChange={(e) => updateCondition(ri, ci, { fieldId: e.target.value, value: "" })}
                    aria-label="Condition field"
                  >
                    {form.fields.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    className="input"
                    value={cond.operator}
                    onChange={(e) =>
                      updateCondition(ri, ci, { operator: e.target.value as typeof cond.operator })
                    }
                    aria-label="Condition operator"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                  {field?.options?.length ? (
                    <select
                      className="input"
                      value={cond.value}
                      onChange={(e) => updateCondition(ri, ci, { value: e.target.value })}
                      aria-label="Condition value"
                    >
                      <option value="">Select value…</option>
                      {field.options.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="input"
                      value={cond.value}
                      placeholder="Value"
                      onChange={(e) => updateCondition(ri, ci, { value: e.target.value })}
                      aria-label="Condition value"
                    />
                  )}
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => removeCondition(ri, ci)}
                    aria-label="Remove condition"
                    disabled={rule.conditions.length <= 1}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}

            <button className="btn btn-ghost btn-sm" onClick={() => addCondition(ri)} style={{ marginBottom: 10 }}>
              <Plus size={13} /> Add condition
            </button>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                Route to
              </label>
              <select
                className="input"
                value={destValue(rule.destination)}
                onChange={(e) => updateRule(ri, { destination: parseDest(e.target.value) })}
                aria-label="Rule destination"
              >
                <option value="">Choose destination…</option>
                <optgroup label="Booking types">
                  {bookingTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Team members">
                  {staffMembers.map((s) => (
                    <option key={s.id} value={`staff:${s.id}`}>{s.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Other">
                  <option value="url:">External URL</option>
                </optgroup>
              </select>
              {rule.destination.externalUrl !== undefined && !rule.destination.appointmentTypeId && !rule.destination.staffId && (
                <input
                  className="input"
                  style={{ marginTop: 8 }}
                  placeholder="https://example.com/book"
                  value={rule.destination.externalUrl}
                  onChange={(e) => updateRule(ri, { destination: { externalUrl: e.target.value } })}
                  aria-label="External URL"
                />
              )}
            </div>
          </div>
        ))
      )}

      <div className="rule-card" style={{ background: "hsl(var(--muted) / 0.5)", borderStyle: "dashed" }}>
        <label style={{ display: "block", fontSize: 12.5, fontWeight: 700, marginBottom: 4 }}>
          Fallback destination
        </label>
        <p className="text-muted-foreground" style={{ fontSize: 12, margin: "0 0 8px" }}>
          Used when no rule matches the submitter's answers.
        </p>
        <select
          className="input"
          value={destValue(form.fallbackDestination || {})}
          onChange={(e) => onChange({ ...form, fallbackDestination: parseDest(e.target.value) })}
          aria-label="Fallback destination"
        >
          <option value="">Choose destination…</option>
          <optgroup label="Booking types">
            {bookingTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </optgroup>
          <optgroup label="Team members">
            {staffMembers.map((s) => (
              <option key={s.id} value={`staff:${s.id}`}>{s.name}</option>
            ))}
          </optgroup>
          <optgroup label="Other">
            <option value="url:">External URL</option>
          </optgroup>
        </select>
        {form.fallbackDestination?.externalUrl !== undefined &&
          !form.fallbackDestination?.appointmentTypeId &&
          !form.fallbackDestination?.staffId && (
            <input
              className="input"
              style={{ marginTop: 8 }}
              placeholder="https://example.com/book"
              value={form.fallbackDestination.externalUrl}
              onChange={(e) => onChange({ ...form, fallbackDestination: { externalUrl: e.target.value } })}
              aria-label="Fallback external URL"
            />
          )}
      </div>
    </div>
  );
}
