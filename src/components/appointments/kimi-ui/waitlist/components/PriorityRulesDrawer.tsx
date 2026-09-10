"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Rule = {
  id: string;
  name: string;
  ruleType: string;
  scoreDelta: number;
  active: boolean;
};

export function PriorityRulesDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [mode, setMode] = useState<"fcfs" | "advanced">("fcfs");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/appointments/service-booking/waitlist-priority")
      .then((r) => r.json())
      .then((j) => {
        const data = (j.data || j || []) as Rule[];
        setRules(Array.isArray(data) ? data : []);
        setMode(data.length ? "advanced" : "fcfs");
      })
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div className="tv-drawer-backdrop" role="presentation" onClick={onClose}>
      <aside className="tv-drawer" role="dialog" aria-labelledby="priority-rules-title" onClick={(e) => e.stopPropagation()}>
        <div className="tv-drawer-head">
          <h2 id="priority-rules-title">Priority rules</h2>
          <button type="button" className="tv-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="tv-page-desc">Customers are served in priority order when an opening becomes available.</p>
        <label className="tv-radio-row">
          <input type="radio" name="priority-mode" checked={mode === "fcfs"} onChange={() => setMode("fcfs")} />
          First come, first served
        </label>
        <label className="tv-radio-row">
          <input type="radio" name="priority-mode" checked={mode === "advanced"} onChange={() => setMode("advanced")} />
          Advanced rules
        </label>
        {loading ? <p className="tv-page-desc">Loading rules…</p> : null}
        {mode === "advanced" && rules.length ? (
          <ul className="tv-rules-list">
            {rules.map((rule) => (
              <li key={rule.id}>
                <strong>{rule.name}</strong>
                <span className="tv-cell-secondary">{rule.ruleType.replace(/_/g, " ")}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {mode === "advanced" && !loading && !rules.length ? (
          <p className="tv-page-desc">No custom rules yet. First come, first served is used.</p>
        ) : null}
      </aside>
    </div>
  );
}
