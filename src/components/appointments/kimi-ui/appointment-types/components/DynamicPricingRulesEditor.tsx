"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

type PricingRule = {
  id: string;
  name: string;
  ruleType: string;
  adjustmentType: string;
  adjustmentValue: number;
  priority?: number;
  active?: boolean;
  conditions?: Record<string, unknown>;
};

const RULE_TYPE_OPTIONS = [
  { value: "day_of_week", label: "Day of week" },
  { value: "time_of_day", label: "Time of day" },
  { value: "last_minute", label: "Last-minute booking" },
  { value: "early_bird", label: "Early bird" },
  { value: "appointment_type", label: "Appointment type" },
] as const;

function formatRuleType(ruleType: string): string {
  return RULE_TYPE_OPTIONS.find((o) => o.value === ruleType)?.label || ruleType;
}

function formatAdjustment(rule: PricingRule): string {
  if (rule.adjustmentType === "percent") {
    const sign = rule.adjustmentValue >= 0 ? "+" : "";
    return `${sign}${rule.adjustmentValue}%`;
  }
  const dollars = (rule.adjustmentValue / 100).toFixed(2);
  const sign = rule.adjustmentValue >= 0 ? "+" : "";
  return `${sign}$${dollars}`;
}

export function DynamicPricingRulesEditor({
  appointmentTypeId,
  basePriceCents,
}: {
  appointmentTypeId?: string;
  basePriceCents?: number;
}) {
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [ruleType, setRuleType] = useState("day_of_week");
  const [adjustmentType, setAdjustmentType] = useState<"percent" | "fixed">("percent");
  const [adjustmentValue, setAdjustmentValue] = useState(10);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 6]);
  const [previewDate, setPreviewDate] = useState("");
  const [previewTime, setPreviewTime] = useState("10:00");
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/appointments/service-booking/dynamic-pricing");
      if (!res.ok) throw new Error("load failed");
      const json = await res.json();
      const all = (json.data || json || []) as PricingRule[];
      const scoped = appointmentTypeId
        ? all.filter((r) => {
            const typeIds = (r.conditions?.appointmentTypeIds as string[] | undefined) || [];
            return typeIds.length === 0 || typeIds.includes(appointmentTypeId);
          })
        : all;
      setRules(scoped);
    } catch {
      setError("Could not load price rules.");
    } finally {
      setLoading(false);
    }
  }, [appointmentTypeId]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  function buildConditions(): Record<string, unknown> {
    const conditions: Record<string, unknown> = {};
    if (appointmentTypeId) {
      conditions.appointmentTypeIds = [appointmentTypeId];
    }
    if (ruleType === "day_of_week") {
      conditions.days = selectedDays;
    }
    if (ruleType === "last_minute") {
      conditions.maxHoursAhead = 24;
    }
    if (ruleType === "early_bird") {
      conditions.minDaysAhead = 7;
    }
    if (ruleType === "time_of_day") {
      conditions.startHour = 9;
      conditions.endHour = 17;
    }
    return conditions;
  }

  async function saveRule() {
    if (!ruleName.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/appointments/service-booking/dynamic-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: ruleName.trim(),
          ruleType,
          adjustmentType,
          adjustmentValue: adjustmentType === "fixed" ? Math.round(adjustmentValue * 100) : adjustmentValue,
          conditions: buildConditions(),
          active: true,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      setRuleName("");
      await loadRules();
    } catch {
      setError("Could not save price rule.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: PricingRule, active: boolean) {
    setSaving(true);
    try {
      await fetch("/api/appointments/service-booking/dynamic-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rule, active }),
      });
      await loadRules();
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(rule: PricingRule) {
    setSaving(true);
    try {
      await fetch("/api/appointments/service-booking/dynamic-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...rule, active: false }),
      });
      await loadRules();
    } finally {
      setSaving(false);
    }
  }

  async function runPreview() {
    if (!previewDate || !appointmentTypeId || !basePriceCents) return;
    const startsAt = new Date(`${previewDate}T${previewTime}:00`).toISOString();
    const res = await fetch("/api/appointments/service-booking/dynamic-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "evaluate",
        basePriceCents,
        startsAt,
        appointmentTypeId,
      }),
    });
    const json = await res.json();
    const data = json.data || json;
    if (data?.finalPriceCents != null) {
      const base = (basePriceCents / 100).toFixed(2);
      const final = (data.finalPriceCents / 100).toFixed(2);
      const adj = (data.adjustments || []) as Array<{ ruleName: string; deltaCents: number }>;
      const lines = adj.map((a) => `${a.ruleName}: ${a.deltaCents >= 0 ? "+" : ""}$${(a.deltaCents / 100).toFixed(2)}`);
      setPreviewResult(`Base $${base} → $${final}${lines.length ? ` (${lines.join("; ")})` : ""}`);
    } else {
      setPreviewResult("No matching rules for this slot.");
    }
  }

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <section>
      <h3 className="text-[14px] font-semibold mb-1">Price rules</h3>
      <p className="text-[12.5px] text-[#8a8fa3] mb-4">
        Adjust this service&apos;s price when specific booking conditions apply.
      </p>

      {loading ? (
        <p className="text-[12px] text-[#8a8fa3] flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading rules…
        </p>
      ) : null}

      {error ? <p className="text-[12px] text-rose-700 mb-3">{error}</p> : null}

      <div className="rounded-xl border border-[#ecedf2] p-4 space-y-3 mb-4">
        <label className="block text-[12px] font-semibold text-[#6b6f82]">Rule name</label>
        <input
          className="input w-full"
          placeholder="Weekend pricing"
          value={ruleName}
          onChange={(e) => setRuleName(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">When</label>
            <select className="input w-full" value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
              {RULE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#6b6f82] mb-1">Price change</label>
            <div className="flex gap-2">
              <select
                className="input w-28"
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as "percent" | "fixed")}
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed $</option>
              </select>
              <input
                type="number"
                className="input flex-1"
                value={adjustmentValue}
                onChange={(e) => setAdjustmentValue(Number(e.target.value))}
              />
            </div>
          </div>
        </div>
        {ruleType === "day_of_week" ? (
          <div className="flex flex-wrap gap-2">
            {dayLabels.map((label, idx) => (
              <button
                key={label}
                type="button"
                className={`rounded-full px-3 py-1 text-[12px] font-medium border ${
                  selectedDays.includes(idx)
                    ? "bg-[#147d74] text-white border-[#147d74]"
                    : "bg-white text-[#3f4254] border-[#e4e6ee]"
                }`}
                onClick={() =>
                  setSelectedDays((days) =>
                    days.includes(idx) ? days.filter((d) => d !== idx) : [...days, idx],
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="btn-brand text-[13px] font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
          disabled={saving || !ruleName.trim()}
          onClick={() => void saveRule()}
        >
          {saving ? "Saving…" : "Add price rule"}
        </button>
      </div>

      {rules.length === 0 && !loading ? (
        <p className="text-[12px] text-[#8a8fa3] rounded-lg border border-dashed border-[#ecedf2] px-4 py-6 text-center">
          No price rules for this service yet.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border border-[#ecedf2] mb-4">
          {rules.map((rule) => (
            <li key={rule.id} className="flex items-center justify-between gap-3 p-3 text-[13px]">
              <div>
                <span className="font-medium text-[#1a1d29]">{rule.name}</span>
                <span className="block text-[12px] text-[#8a8fa3]">
                  {formatRuleType(rule.ruleType)} · {formatAdjustment(rule)}
                  {rule.active === false ? " · Disabled" : ""}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="text-[12px] text-[#147d74] font-medium"
                  disabled={saving}
                  onClick={() => void toggleRule(rule, rule.active === false)}
                >
                  {rule.active === false ? "Enable" : "Disable"}
                </button>
                <button
                  type="button"
                  className="text-[#a0a3b5] hover:text-rose-600"
                  disabled={saving}
                  aria-label={`Delete ${rule.name}`}
                  onClick={() => void deleteRule(rule)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {appointmentTypeId && basePriceCents && basePriceCents > 0 ? (
        <div className="rounded-xl border border-[#ecedf2] bg-[#fafbfc]/60 p-4 space-y-2">
          <p className="text-[12px] font-semibold text-[#6b6f82]">Price preview</p>
          <div className="flex flex-wrap gap-2 items-end">
            <input type="date" className="input" value={previewDate} onChange={(e) => setPreviewDate(e.target.value)} aria-label="Preview date" />
            <input type="time" className="input" value={previewTime} onChange={(e) => setPreviewTime(e.target.value)} aria-label="Preview time" />
            <button type="button" className="text-[12px] font-medium text-[#147d74]" onClick={() => void runPreview()}>
              Preview price
            </button>
          </div>
          {previewResult ? <p className="text-[12px] text-[#3f4254]">{previewResult}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
