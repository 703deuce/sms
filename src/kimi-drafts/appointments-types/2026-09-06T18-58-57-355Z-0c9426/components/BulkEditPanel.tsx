"use client";

import { useState } from "react";
import { Layers, X } from "lucide-react";

type Props = {
  types: Array<{ id: string; name: string }>;
  onApplied: () => void;
};

export default function BulkEditPanel({ types, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<"activate" | "pause" | "schedule">("activate");

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="mt-5">
      <button
        type="button"
        className="btn-secondary flex items-center gap-1.5 h-8.5 px-3.5 rounded-lg text-[12.5px] font-medium"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Layers size={13} className="text-[#8a8fa3]" /> Bulk edit booking types
      </button>

      {open ? (
        <div className="panel mt-3 animate-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#ecedf2]">
            <h3 className="text-[13px] font-semibold text-[#1a1d29]">
              Bulk edit {selected.size > 0 ? `· ${selected.size} selected` : ""}
            </h3>
            <button
              type="button"
              className="p-1 rounded-md text-[#a7abb9] hover:bg-[#f2f4f7] hover:text-[#3c4257]"
              onClick={() => setOpen(false)}
              aria-label="Close bulk edit"
            >
              <X size={15} />
            </button>
          </div>
          <div className="px-4 py-4 grid grid-cols-1 md:grid-cols-[1fr_220px_auto] gap-4">
            <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
              {types.map((t) => (
                <label key={t.id} className="flex items-center gap-2.5 py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#d8dbe6] accent-[#4f46e5]"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                  />
                  <span className="text-[13px] text-[#3c4257]">{t.name}</span>
                </label>
              ))}
            </div>
            <div>
              <label className="field-label" htmlFor="bulk-action">
                Action
              </label>
              <select
                id="bulk-action"
                className="field-input"
                value={action}
                onChange={(e) => setAction(e.target.value as typeof action)}
              >
                <option value="activate">Set to active</option>
                <option value="pause">Pause bookings</option>
                <option value="schedule">Assign Standard Hours</option>
              </select>
              <p className="field-hint">
                Applies to {selected.size || "…"} selected booking type{selected.size === 1 ? "" : "s"}.
              </p>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                className="btn-brand h-8.5 px-4 rounded-lg text-[13px] font-semibold shadow-sm transition-all active:scale-[0.98]"
                disabled={selected.size === 0}
                onClick={() => {
                  onApplied();
                  setSelected(new Set());
                  setOpen(false);
                }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
