"use client";

import { useCallback, useEffect, useState } from "react";

const RECALL_PRESETS = [
  { id: "due_this_month", label: "Due for service this month" },
  { id: "overdue", label: "Overdue recalls" },
  { id: "due_by_type", label: "Due by booking type" },
] as const;

type SavedView = {
  id: string;
  name: string;
  preset: string;
  bookingTypeName?: string;
};

export function RecallSavedViewsPanel() {
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<string>(RECALL_PRESETS[0].id);
  const [bookingTypeName, setBookingTypeName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("appointments.recallSavedViews");
      if (raw) setViews(JSON.parse(raw) as SavedView[]);
    } catch {
      setViews([]);
    }
  }, []);

  const persist = useCallback((next: SavedView[]) => {
    setViews(next);
    localStorage.setItem("appointments.recallSavedViews", JSON.stringify(next));
  }, []);

  function saveView() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const view: SavedView = {
      id: `view_${Date.now()}`,
      name: trimmed,
      preset,
      bookingTypeName: preset === "due_by_type" ? bookingTypeName.trim() : undefined,
    };
    persist([view, ...views]);
    setName("");
  }

  function removeView(id: string) {
    persist(views.filter((v) => v.id !== id));
  }

  return (
    <section className="tv-table-wrap p-4 space-y-4" aria-labelledby="recall-saved-views-title">
      <div>
        <h2 id="recall-saved-views-title" className="tv-section-title" style={{ margin: 0 }}>
          Saved recall views
        </h2>
        <p className="tv-subtitle mt-1">
          Save filters for customers due for service, overdue recalls, or due by booking type.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="text-muted-foreground">View name</span>
          <input
            className="mt-1 block h-9 rounded-md border px-2 min-w-[200px]"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Overdue training clients"
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Filter</span>
          <select
            className="mt-1 block h-9 rounded-md border px-2"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
          >
            {RECALL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        {preset === "due_by_type" ? (
          <label className="text-sm">
            <span className="text-muted-foreground">Booking type</span>
            <input
              className="mt-1 block h-9 rounded-md border px-2"
              value={bookingTypeName}
              onChange={(e) => setBookingTypeName(e.target.value)}
            />
          </label>
        ) : null}
        <button type="button" className="tv-btn tv-btn-primary h-9" onClick={saveView}>
          Save view
        </button>
      </div>

      {views.length === 0 ? (
        <p className="text-sm text-muted-foreground">No saved views yet.</p>
      ) : (
        <ul className="space-y-2">
          {views.map((view) => (
            <li key={view.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{view.name}</p>
                <p className="text-muted-foreground text-xs">
                  {RECALL_PRESETS.find((p) => p.id === view.preset)?.label}
                  {view.bookingTypeName ? ` · ${view.bookingTypeName}` : ""}
                </p>
              </div>
              <button type="button" className="tv-btn text-xs" onClick={() => removeView(view.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
