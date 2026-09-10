"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newRoutingRule } from "@/features/appointments/kimi/shared/platform-settings-types";
import type { RoutingRule } from "@/lib/appointments/types";

type Props = {
  embedded?: boolean;
};

export function LegacyRoutingRulesPanel({ embedded = false }: Props) {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, typesRes] = await Promise.all([
        fetch("/api/appointments/settings"),
        fetch("/api/appointments/types"),
      ]);
      const settingsJson = settingsRes.ok ? await settingsRes.json() : { data: {} };
      const typesJson = typesRes.ok ? await typesRes.json() : { data: [] };
      setRules((settingsJson.data?.routingRules || []) as RoutingRule[]);
      setAppointmentTypes(
        (typesJson.data || []).map((t: { id: string; name: string }) => ({ id: t.id, name: t.name })),
      );
    } catch {
      setError("Could not load legacy routing rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateRule(index: number, patch: Partial<RoutingRule>) {
    setRules((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function updateCondition(ruleIndex: number, condIndex: number, field: string, value: string) {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== ruleIndex) return r;
        const conditions = [...r.conditions];
        conditions[condIndex] = { ...conditions[condIndex], [field]: value };
        return { ...r, conditions };
      }),
    );
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ routingRules: rules }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "Could not save");
      return;
    }
    await load();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading answer-based routing rules…</p>;
  }

  return (
    <section className={embedded ? "space-y-4 rounded-xl border bg-card p-5" : "space-y-4"}>
      <header>
        <h2 className="text-base font-semibold text-foreground">Answer-based routing rules</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Route customers to a booking type when their booking question answers match these rules. New
          workspaces should use routing forms above; these rules remain for existing public booking flows.
        </p>
      </header>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <GitBranch className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" aria-hidden />
          No answer-based rules yet.
        </div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule, ruleIndex) => (
            <div key={rule.id} className="space-y-4 rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <input
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Rule name"
                  value={rule.name || ""}
                  onChange={(e) => updateRule(ruleIndex, { name: e.target.value })}
                />
                <select
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={rule.logic || "and"}
                  onChange={(e) => updateRule(ruleIndex, { logic: e.target.value as "and" | "or" })}
                >
                  <option value="and">AND</option>
                  <option value="or">OR</option>
                </select>
                <button
                  type="button"
                  onClick={() => setRules((p) => p.filter((_, i) => i !== ruleIndex))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove rule"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {rule.conditions.map((cond, condIndex) => (
                <div key={condIndex} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-8 text-muted-foreground">If</span>
                  <input
                    className="min-w-[120px] flex-1 rounded-md border border-input bg-background px-3 py-2"
                    placeholder="Question field"
                    value={cond.field}
                    onChange={(e) => updateCondition(ruleIndex, condIndex, "field", e.target.value)}
                  />
                  <select
                    className="rounded-md border border-input bg-background px-2 py-2"
                    value={cond.operator}
                    onChange={(e) => updateCondition(ruleIndex, condIndex, "operator", e.target.value)}
                  >
                    <option value="equals">equals</option>
                    <option value="not_equals">does not equal</option>
                  </select>
                  <input
                    className="min-w-[120px] flex-1 rounded-md border border-input bg-background px-3 py-2"
                    placeholder="Value"
                    value={cond.value || ""}
                    onChange={(e) => updateCondition(ruleIndex, condIndex, "value", e.target.value)}
                  />
                </div>
              ))}

              <button
                type="button"
                className="text-sm text-primary"
                onClick={() =>
                  updateRule(ruleIndex, {
                    conditions: [...rule.conditions, { field: "", operator: "equals", value: "" }],
                  })
                }
              >
                + Add condition
              </button>

              <div className="border-t pt-3">
                <label className="mb-2 block text-xs font-semibold text-muted-foreground">
                  Then route to
                </label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={rule.destination.appointmentTypeId || ""}
                  onChange={(e) =>
                    updateRule(ruleIndex, {
                      destination: { ...rule.destination, appointmentTypeId: e.target.value },
                    })
                  }
                >
                  <option value="">Select booking type</option>
                  {appointmentTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setRules((p) => [...p, newRoutingRule()])}>
          <Plus className="mr-1 h-4 w-4" /> Add rule
        </Button>
        <div className="flex items-center gap-3">
          {error ? <span className="text-sm text-destructive">{error}</span> : null}
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save answer-based rules"}
          </Button>
        </div>
      </div>
    </section>
  );
}
