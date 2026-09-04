"use client";

import { useCallback, useEffect, useState } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { newRoutingRule } from "@/features/appointments/kimi/shared/platform-settings-types";
import type { RoutingRule } from "@/lib/appointments/types";

export function RoutingConnected() {
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

  if (loading) return <div className="p-8 text-sm text-gray-500">Loading routing…</div>;

  return (
    <div className="min-h-screen bg-[#f7f8fb] p-6 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[24px] font-bold text-[#1a1d29]">Routing</h1>
            <p className="text-[13px] text-[#8a8fa3] mt-1">
              Route customers to the right appointment type based on booking answers.
            </p>
          </div>
          <Button onClick={() => setRules((p) => [...p, newRoutingRule()])} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add rule
          </Button>
        </div>

        {rules.length === 0 ? (
          <div className="rounded-xl border bg-white p-12 text-center text-[13px] text-[#8a8fa3]">
            <GitBranch className="h-8 w-8 mx-auto mb-2 text-[#c6c9d6]" />
            No routing rules yet. Add rules to direct customers based on their answers.
          </div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule, ruleIndex) => (
              <div key={rule.id} className="rounded-xl border bg-white p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    className="flex-1 rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px] font-medium"
                    placeholder="Rule name"
                    value={rule.name || ""}
                    onChange={(e) => updateRule(ruleIndex, { name: e.target.value })}
                  />
                  <select
                    className="rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                    value={rule.logic || "and"}
                    onChange={(e) => updateRule(ruleIndex, { logic: e.target.value as "and" | "or" })}
                  >
                    <option value="and">AND</option>
                    <option value="or">OR</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setRules((p) => p.filter((_, i) => i !== ruleIndex))}
                    className="text-[#a0a3b5] hover:text-rose-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {rule.conditions.map((cond, condIndex) => (
                  <div key={condIndex} className="flex gap-2 items-center text-[13px]">
                    <span className="text-[#8a8fa3] w-12">If</span>
                    <input
                      className="flex-1 rounded-lg border border-[#e4e6ee] px-3 py-2"
                      placeholder="Question field"
                      value={cond.field}
                      onChange={(e) => updateCondition(ruleIndex, condIndex, "field", e.target.value)}
                    />
                    <select
                      className="rounded-lg border border-[#e4e6ee] px-2 py-2"
                      value={cond.operator}
                      onChange={(e) => updateCondition(ruleIndex, condIndex, "operator", e.target.value)}
                    >
                      <option value="equals">equals</option>
                      <option value="not_equals">does not equal</option>
                    </select>
                    <input
                      className="flex-1 rounded-lg border border-[#e4e6ee] px-3 py-2"
                      placeholder="Value"
                      value={cond.value || ""}
                      onChange={(e) => updateCondition(ruleIndex, condIndex, "value", e.target.value)}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  className="text-[12px] text-[#5b4bff]"
                  onClick={() =>
                    updateRule(ruleIndex, {
                      conditions: [
                        ...rule.conditions,
                        { field: "", operator: "equals", value: "" },
                      ],
                    })
                  }
                >
                  + Add condition
                </button>

                <div className="pt-3 border-t">
                  <label className="block text-[12px] font-semibold text-[#6b6f82] mb-2">Then route to</label>
                  <select
                    className="w-full rounded-lg border border-[#e4e6ee] px-3 py-2 text-[13px]"
                    value={rule.destination.appointmentTypeId || ""}
                    onChange={(e) =>
                      updateRule(ruleIndex, {
                        destination: { ...rule.destination, appointmentTypeId: e.target.value },
                      })
                    }
                  >
                    <option value="">Select appointment type</option>
                    {appointmentTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          {error ? <span className="text-[12px] text-rose-600 self-center">{error}</span> : null}
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save routing rules"}
          </Button>
        </div>
      </div>
    </div>
  );
}
