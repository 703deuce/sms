"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AvailabilityFormState, DateOverride } from "@/features/appointments/kimi/availability/types";

type SpecialDateRow = {
  id: string;
  date: string;
  label: string;
  state: string;
  kind: "override" | "blackout" | "holiday";
};

function formatDateLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

type Props = {
  form: AvailabilityFormState;
  onPatch: (patch: Partial<AvailabilityFormState>) => void;
  onSave: () => void;
  saving: boolean;
};

export function SpecialDatesSection({ form, onPatch, onSave, saving }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftClosed, setDraftClosed] = useState(true);
  const [draftOpen, setDraftOpen] = useState("10:00");
  const [draftClose, setDraftClose] = useState("14:00");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftKind, setDraftKind] = useState<"override" | "blackout" | "holiday">("override");

  const rows = useMemo((): SpecialDateRow[] => {
    const list: SpecialDateRow[] = [];
    for (const o of form.dateOverrides) {
      list.push({
        id: `override-${o.date}`,
        date: o.date,
        label: "",
        state: o.closed
          ? "Closed"
          : o.windows?.length
            ? o.windows.map((w) => `${formatTime12h(w.open)}–${formatTime12h(w.close)}`).join(", ")
            : "Custom hours",
        kind: "override",
      });
    }
    for (const d of form.blackoutDates) {
      if (form.dateOverrides.some((o) => o.date === d)) continue;
      list.push({
        id: `blackout-${d}`,
        date: d,
        label: "Blackout",
        state: "Closed",
        kind: "blackout",
      });
    }
    for (const h of form.holidays) {
      if (form.dateOverrides.some((o) => o.date === h.date)) continue;
      list.push({
        id: `holiday-${h.date}`,
        date: h.date,
        label: h.name,
        state: h.closed ? "Closed" : "Holiday",
        kind: "holiday",
      });
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [form.blackoutDates, form.dateOverrides, form.holidays]);

  function removeRow(row: SpecialDateRow) {
    if (row.kind === "override") {
      onPatch({ dateOverrides: form.dateOverrides.filter((o) => o.date !== row.date) });
    } else if (row.kind === "blackout") {
      onPatch({ blackoutDates: form.blackoutDates.filter((d) => d !== row.date) });
    } else {
      onPatch({ holidays: form.holidays.filter((h) => h.date !== row.date) });
    }
  }

  function saveDrawer() {
    if (!draftDate) return;
    if (draftKind === "blackout") {
      onPatch({
        blackoutDates: [...new Set([...form.blackoutDates, draftDate])].sort(),
      });
    } else if (draftKind === "holiday") {
      const name = draftLabel.trim() || "Holiday";
      onPatch({
        holidays: [...form.holidays.filter((h) => h.date !== draftDate), { date: draftDate, name, closed: true }],
      });
    } else {
      const entry: DateOverride = draftClosed
        ? { date: draftDate, closed: true }
        : { date: draftDate, windows: [{ open: draftOpen, close: draftClose }] };
      onPatch({
        dateOverrides: [...form.dateOverrides.filter((o) => o.date !== draftDate), entry].sort((a, b) =>
          a.date.localeCompare(b.date),
        ),
      });
    }
    setDrawerOpen(false);
    setDraftDate("");
    setDraftLabel("");
    void onSave();
  }

  const US_HOLIDAYS = [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-07-04", name: "Independence Day" },
    { date: "2026-11-26", name: "Thanksgiving" },
    { date: "2026-12-25", name: "Christmas Day" },
  ];

  return (
    <>
      <section className="avail-card avail-fade-in avail-fade-in-3">
        <div className="avail-card-header flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="avail-icon-chip mt-0.5">
              <CalendarDays size={15} />
            </span>
            <div>
              <h2 className="text-[14.5px] font-semibold text-[#1c1a2e]">Special dates</h2>
              <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
                Close specific days or use different hours without changing your regular schedule.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus size={14} className="mr-1" />
            Add special date
          </Button>
        </div>

        <div className="px-[22px] py-4">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#8a87a0]">No special dates yet.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#f2f1f7] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[#1c1a2e]">
                      {row.label || formatDateLabel(row.date)}
                    </p>
                    <p className="text-[12px] text-[#8a87a0]">
                      {formatDateLabel(row.date)} · {row.state}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="avail-icon-btn"
                      aria-label={`Remove ${row.label || row.date}`}
                      onClick={() => removeRow(row)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="special-date-drawer-title">
          <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 id="special-date-drawer-title" className="text-[15px] font-bold">Add special date</h2>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-[#8a87a0] hover:text-[#1a1830]">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <label className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium">Date</span>
                <input type="date" className="input" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
              </label>

              <fieldset className="space-y-2">
                <legend className="text-[13px] font-medium mb-2">Type</legend>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="radio" name="special-type" checked={draftKind === "override" && draftClosed} onChange={() => { setDraftKind("override"); setDraftClosed(true); }} />
                  Closed
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="radio" name="special-type" checked={draftKind === "override" && !draftClosed} onChange={() => { setDraftKind("override"); setDraftClosed(false); }} />
                  Custom hours
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="radio" name="special-type" checked={draftKind === "holiday"} onChange={() => setDraftKind("holiday")} />
                  Holiday (closed)
                </label>
              </fieldset>

              {draftKind === "override" && !draftClosed ? (
                <div className="flex gap-3">
                  <label className="flex flex-col gap-1 text-[13px] flex-1">
                    <span>Open</span>
                    <input type="time" className="input" value={draftOpen} onChange={(e) => setDraftOpen(e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1 text-[13px] flex-1">
                    <span>Close</span>
                    <input type="time" className="input" value={draftClose} onChange={(e) => setDraftClose(e.target.value)} />
                  </label>
                </div>
              ) : null}

              <label className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium">Label (optional)</span>
                <input className="input" placeholder="Holiday, team training…" value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} />
              </label>

              <div className="rounded-lg border border-[#eceaf3] p-3 space-y-2">
                <p className="text-[12px] font-medium text-[#6b6880]">Add known holiday</p>
                <div className="flex flex-wrap gap-2">
                  {US_HOLIDAYS.map((h) => (
                    <button
                      key={h.date}
                      type="button"
                      className="rounded-full border border-[#eceaf3] px-3 py-1 text-[11px] hover:bg-[#f7f6ff]"
                      onClick={() => {
                        setDraftDate(h.date);
                        setDraftLabel(h.name);
                        setDraftKind("holiday");
                      }}
                    >
                      {h.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t px-5 py-4 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button type="button" size="sm" disabled={!draftDate || saving} onClick={saveDrawer}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
