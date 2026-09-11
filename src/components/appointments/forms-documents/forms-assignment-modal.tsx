"use client";

import { useEffect, useMemo, useState } from "react";
import type { OfferingKind } from "@/lib/appointments/forms-documents/forms-workspace";
import { intakeFormIdsFromTypeConfig } from "@/lib/appointments/forms-documents/forms-workspace";

type ApiType = {
  id: string;
  name: string;
  durationMinutes?: number;
  config?: unknown;
};

type Props = {
  open: boolean;
  formId: string;
  formName: string;
  onClose: () => void;
  onSaved: () => void;
};

const FILTERS: Array<{ id: "all" | OfferingKind; label: string }> = [
  { id: "all", label: "All" },
  { id: "service", label: "Services" },
  { id: "class", label: "Classes" },
  { id: "workshop", label: "Workshops" },
  { id: "meeting", label: "Meetings" },
];

function kindFromConfig(config: unknown): OfferingKind {
  const c = config as { bookingTypeKind?: string };
  const k = String(c?.bookingTypeKind || "SERVICE").toUpperCase();
  if (k === "MEETING") return "meeting";
  if (k === "CLASS") return "class";
  if (k === "WORKSHOP") return "workshop";
  return "service";
}

export function FormsAssignmentModal({ open, formId, formName, onClose, onSaved }: Props) {
  const [types, setTypes] = useState<ApiType[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | OfferingKind>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    void fetch("/api/appointments/types")
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.data || []) as ApiType[];
        setTypes(rows);
        const attached = new Set<string>();
        for (const t of rows) {
          const ids = intakeFormIdsFromTypeConfig(t.config);
          if (ids.includes(formId)) attached.add(t.id);
        }
        setSelected(attached);
      })
      .catch(() => setError("Could not load offerings"))
      .finally(() => setLoading(false));
  }, [open, formId]);

  const filtered = useMemo(() => {
    let rows = types.map((t) => ({
      ...t,
      kind: kindFromConfig(t.config),
      formIds: intakeFormIdsFromTypeConfig(t.config),
    }));
    if (filter !== "all") rows = rows.filter((r) => r.kind === filter);
    const q = query.trim().toLowerCase();
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    return rows;
  }, [types, filter, query]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const t of types) {
        const ids = intakeFormIdsFromTypeConfig(t.config);
        const shouldHave = selected.has(t.id);
        const has = ids.includes(formId);
        if (shouldHave === has) continue;
        const nextIds = shouldHave ? [...ids, formId] : ids.filter((id) => id !== formId);
        const config = { ...(t.config as object), intakeFormIds: nextIds };
        const res = await fetch(`/api/appointments/types/${t.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error((json as { error?: string }).error || `Could not update ${t.name}`);
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="assign-form-title">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 id="assign-form-title" className="text-base font-semibold">Assign {formName}</h2>
          <p className="text-sm text-[var(--text-secondary)]">
            Changes sync with Service, Class, Workshop, and Meeting customer setup.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-4 py-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`ws-chip ${filter === f.id ? "ws-chip-accent" : "ws-chip-neutral"}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <input className="input ml-auto min-w-[160px] flex-1" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="p-4 text-sm text-[var(--text-secondary)]">Loading offerings…</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((row) => (
                <li key={row.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-2 py-2.5 text-sm hover:bg-[var(--surface-muted)]">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(row.id);
                          else next.delete(row.id);
                          return next;
                        });
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{row.name}</span>
                      <span className="text-[var(--type-helper)] text-[var(--text-secondary)] capitalize">
                        {row.kind}
                        {row.durationMinutes ? ` · ${row.durationMinutes} min` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3">
          {error ? <span className="ws-inline-error text-sm">{error}</span> : <span />}
          <div className="flex gap-2">
            <button type="button" className="ws-secondary-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="appt-pilot-primary-btn" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save assignments"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
