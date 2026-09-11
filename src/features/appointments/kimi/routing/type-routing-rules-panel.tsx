"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newRoutingRule } from "@/features/appointments/kimi/shared/platform-settings-types";
import type { RoutingRule } from "@/lib/appointments/types";

/** Legacy workspace rules: route to appointment types from booking answers (not staff assignment). */
export function TypeRoutingRulesPanel() {
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
      setError("Could not load routing rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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

  if (loading) return <div className="p-6 text-sm text-[var(--text-secondary)]">Loading type routing rules…</div>;

  return (
    <div className="space-y-4 p-4 lg:px-6">
      <p className="text-xs text-[var(--text-secondary)]">
        These rules change which appointment type a customer books based on answers. They do not assign staff.
      </p>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={() => setRules((p) => [...p, newRoutingRule()])} size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Add rule
        </Button>
        <Button onClick={save} size="sm" className="ml-2" disabled={saving}>
          {saving ? "Saving…" : "Save rules"}
        </Button>
      </div>
      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-secondary)]">
          <GitBranch className="mx-auto mb-2 h-8 w-8 opacity-40" />
          No type routing rules configured.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, ruleIndex) => (
            <div key={rule.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 rounded-md border border-[var(--border)] px-2 py-1.5"
                  placeholder="Rule name"
                  value={rule.name || ""}
                  onChange={(e) => updateRule(ruleIndex, { name: e.target.value })}
                />
                <button type="button" onClick={() => setRules((p) => p.filter((_, i) => i !== ruleIndex))}>
                  <Trash2 size={14} />
                </button>
              </div>
              {rule.conditions.map((cond, condIndex) => (
                <div key={condIndex} className="flex flex-wrap gap-2">
                  <input
                    className="min-w-[120px] flex-1 rounded-md border border-[var(--border)] px-2 py-1"
                    placeholder="Field"
                    value={cond.field}
                    onChange={(e) => updateCondition(ruleIndex, condIndex, "field", e.target.value)}
                  />
                  <input
                    className="min-w-[120px] flex-1 rounded-md border border-[var(--border)] px-2 py-1"
                    placeholder="Value"
                    value={cond.value || ""}
                    onChange={(e) => updateCondition(ruleIndex, condIndex, "value", e.target.value)}
                  />
                </div>
              ))}
              <select
                className="w-full rounded-md border border-[var(--border)] px-2 py-1.5"
                value={rule.destination?.appointmentTypeId || ""}
                onChange={(e) =>
                  updateRule(ruleIndex, {
                    destination: { ...rule.destination, appointmentTypeId: e.target.value },
                  })
                }
              >
                <option value="">Select destination type</option>
                {appointmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
