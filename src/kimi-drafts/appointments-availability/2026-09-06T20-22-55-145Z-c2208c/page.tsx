"use client";

import { useCallback, useMemo, useState } from "react";
import { Clock, BookOpen, AlertTriangle } from "lucide-react";
import BookingRules from "./components/BookingRules";
import NamedSchedules from "./components/NamedSchedules";
import WeeklyHours from "./components/WeeklyHours";
import BookingLimits from "./components/BookingLimits";
import DateOverrides from "./components/DateOverrides";
import Holidays from "./components/Holidays";
import AvailabilitySummary from "./components/AvailabilitySummary";
import LivePreview from "./components/LivePreview";
import SlotDiagnostics from "./components/SlotDiagnostics";
import CalendarIntegrationsCard from "./components/CalendarIntegrationsCard";
import {
  EMPTY_AVAILABILITY_FORM,
  DAY_LABELS,
  formatWindowRange,
  type AvailabilityFormState,
  type TimeWindow,
} from "./mock-data";
import "./reference.css";

type ViewState = "normal" | "loading" | "error";

export default function AvailabilityPage() {
  const [form, setForm] = useState<AvailabilityFormState>(EMPTY_AVAILABILITY_FORM);
  const [state, setState] = useState<ViewState>("normal");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const patchForm = useCallback((patch: Partial<AvailabilityFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const updateWindow = useCallback(
    (day: string, index: number, field: "open" | "close", value: string) => {
      setForm((prev) => {
        const next = { ...prev.weeklyHours };
        const windows = [...(next[day] || [])];
        windows[index] = { ...windows[index], [field]: value };
        next[day] = windows;
        return { ...prev, weeklyHours: next };
      });
      setSaved(false);
    },
    [],
  );

  const addWindow = useCallback((day: string) => {
    setForm((prev) => ({
      ...prev,
      weeklyHours: {
        ...prev.weeklyHours,
        [day]: [...(prev.weeklyHours[day] || []), { open: "09:00", close: "12:00" }],
      },
    }));
    setSaved(false);
  }, []);

  const removeWindow = useCallback((day: string, index: number) => {
    setForm((prev) => ({
      ...prev,
      weeklyHours: {
        ...prev.weeklyHours,
        [day]: (prev.weeklyHours[day] || []).filter((_, i) => i !== index),
      },
    }));
    setSaved(false);
  }, []);

  const addOverride = useCallback(() => {
    setForm((prev) => {
      if (!prev.overrideDate) return prev;
      const entry = prev.overrideClosed
        ? { date: prev.overrideDate, closed: true as const }
        : { date: prev.overrideDate, windows: [{ open: prev.overrideOpen, close: prev.overrideClose }] };
      return {
        ...prev,
        dateOverrides: [...prev.dateOverrides.filter((o) => o.date !== prev.overrideDate), entry].sort(
          (a, b) => a.date.localeCompare(b.date),
        ),
        overrideDate: "",
      };
    });
    setSaved(false);
  }, []);

  const removeOverride = useCallback((date: string) => {
    setForm((prev) => ({
      ...prev,
      dateOverrides: prev.dateOverrides.filter((o) => o.date !== date),
    }));
    setSaved(false);
  }, []);

  const addHoliday = useCallback(() => {
    setForm((prev) => {
      if (!prev.holidayDate || !prev.holidayName.trim()) return prev;
      const entry = { date: prev.holidayDate, name: prev.holidayName.trim(), closed: prev.holidayClosed };
      return {
        ...prev,
        holidays: [
          ...prev.holidays.filter((h) => !(h.date === entry.date && h.name === entry.name)),
          entry,
        ].sort((a, b) => a.date.localeCompare(b.date)),
        holidayDate: "",
        holidayName: "",
        holidayClosed: true,
      };
    });
    setSaved(false);
  }, []);

  const removeHoliday = useCallback((date: string, name: string) => {
    setForm((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => !(h.date === date && h.name === name)),
    }));
    setSaved(false);
  }, []);

  const selectSchedule = useCallback((id: string) => {
    setForm((prev) => ({ ...prev, activeScheduleId: id }));
    setSaved(false);
  }, []);

  const saveCurrentAsSchedule = useCallback((name: string) => {
    setForm((prev) => {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `schedule-${prev.namedSchedules.length + 1}`;
      const openDays = DAY_LABELS.filter(({ key }) => (prev.weeklyHours[key] || []).length > 0).length;
      return {
        ...prev,
        namedSchedules: [...prev.namedSchedules, { id, name, openDays }],
        activeScheduleId: id,
      };
    });
    setSaved(false);
  }, []);

  const save = useCallback(() => {
    setSaving(true);
    setSaved(false);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
    }, 800);
  }, []);

  const openDays = useMemo(
    () => DAY_LABELS.filter(({ key }) => (form.weeklyHours[key] || []).length > 0).length,
    [form.weeklyHours],
  );

  const summary = useMemo(
    () => [
      { icon: "globe" as const, bg: "#efecfd", color: "#5b45e0", title: "Timezone", value: form.timezone },
      { icon: "clock" as const, bg: "#e6f7ef", color: "#16a05a", title: "Minimum notice", value: `${form.minimumNotice} minutes` },
      { icon: "calendar" as const, bg: "#e8f1fd", color: "#2f6fd0", title: "Booking horizon", value: `${form.maximumDays} days ahead` },
      { icon: "calendar-range" as const, bg: "#fdf1e4", color: "#c46a1b", title: "Open days", value: `${openDays} of 7 days` },
      { icon: "sparkles" as const, bg: "#fdeef5", color: "#c2347f", title: "Date overrides", value: `${form.dateOverrides.length} scheduled` },
    ],
    [form, openDays],
  );

  const previewDays = useMemo(() => {
    const overrideMap = new Map(form.dateOverrides.map((o) => [o.date, o]));
    const holidayMap = new Map(form.holidays.filter((h) => h.closed).map((h) => [h.date.slice(5), h]));
    const rows = [];
    for (let i = 1; i <= 5; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const override = overrideMap.get(iso);
      const holiday = holidayMap.get(iso.slice(5));
      const dayKey = DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1].key;
      const windows: TimeWindow[] = form.weeklyHours[dayKey] || [];
      let status: "open" | "closed" | "override" = "open";
      let hours: string | undefined;
      if (override?.closed || holiday) {
        status = "override";
      } else if (override?.windows?.length) {
        status = "override";
        hours = formatWindowRange(override.windows);
      } else if (!windows.length) {
        status = "closed";
      } else {
        hours = formatWindowRange(windows);
      }
      rows.push({
        label: i === 1 ? "Tomorrow" : "",
        date: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
        hours: status === "closed" ? undefined : hours,
        status,
      });
    }
    return rows;
  }, [form]);

  if (state === "loading") {
    return (
      <div className="avail-page min-h-full p-8 animate-pulse" style={{ background: "#f8f7fc" }}>
        <div className="max-w-[1280px] mx-auto space-y-5">
          <div className="h-8 w-48 rounded bg-[#e6e3f0]" />
          <div className="h-40 rounded-xl bg-white border border-[#eceaf3]" />
          <div className="h-72 rounded-xl bg-white border border-[#eceaf3]" />
          <div className="flex gap-3">
            <button className="avail-btn-ghost !bg-white border !border-[#e9e7f2]" onClick={() => setState("normal")}>
              Back to normal
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="avail-page min-h-full p-8 flex items-center justify-center" style={{ background: "#f8f7fc" }}>
        <div className="max-w-md w-full text-center rounded-xl border border-dashed border-[#e3e0ee] bg-white px-6 py-12">
          <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#efecfd] text-[#5b45e0]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-[#1c1a2e]">We couldn&apos;t load availability</h3>
          <p className="mt-1.5 text-[13px] text-[#8a87a0]">
            Something went wrong while fetching your booking rules and weekly hours.
          </p>
          <button className="avail-btn-primary mt-5" onClick={() => setState("normal")}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="avail-page min-h-full bg-[#f8f7fc] text-[#1c1a2e]">
      <div className="max-w-[1280px] mx-auto px-10 pt-9 pb-10">
        <div className="flex items-start justify-between mb-7 avail-fade-in">
          <div className="flex items-start gap-3.5">
            <span className="w-10 h-10 rounded-full bg-[#efecfd] text-[#5b45e0] flex items-center justify-center mt-0.5 ring-4 ring-[#efecfd]/40">
              <Clock size={19} strokeWidth={2.1} />
            </span>
            <div>
              <h1 className="text-[21px] leading-7 font-bold tracking-tight">Availability</h1>
              <p className="text-[13px] text-[#8a87a0] mt-1 leading-snug">
                Control when customers can book. Public booking, manual booking, and slot validation all use these rules.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="avail-btn-ghost !bg-white border !border-[#e9e7f2] shadow-[0_1px_2px_rgba(28,26,46,0.05)] hover:!border-[#d9d5ec] hover:text-[#5b45e0] transition-colors"
              onClick={() => setState(state === "normal" ? "loading" : "normal")}
            >
              <BookOpen size={13} />
              Learn about availability
            </button>
          </div>
        </div>

        <div className="space-y-5 mb-5">
          <NamedSchedules
            schedules={form.namedSchedules}
            activeScheduleId={form.activeScheduleId}
            onSelect={selectSchedule}
            onSaveCurrentAs={saveCurrentAsSchedule}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_288px] gap-6 items-start">
          <div className="space-y-5 min-w-0">
            <BookingRules
              timezone={form.timezone}
              minimumNotice={form.minimumNotice}
              maximumDays={form.maximumDays}
              onTimezoneChange={(v) => patchForm({ timezone: v })}
              onMinimumNoticeChange={(v) => patchForm({ minimumNotice: v })}
              onMaximumDaysChange={(v) => patchForm({ maximumDays: v })}
            />
            <WeeklyHours
              weeklyHours={form.weeklyHours}
              onUpdateWindow={updateWindow}
              onAddWindow={addWindow}
              onRemoveWindow={removeWindow}
            />
            <BookingLimits
              maxPerDay={form.maxPerDay}
              maxPerWeek={form.maxPerWeek}
              maxPerMonth={form.maxPerMonth}
              maxPerTypePerDay={form.maxPerTypePerDay}
              onChange={(field, value) => patchForm({ [field]: value })}
            />
            <DateOverrides
              overrides={form.dateOverrides}
              overrideDate={form.overrideDate}
              overrideClosed={form.overrideClosed}
              overrideOpen={form.overrideOpen}
              overrideClose={form.overrideClose}
              onOverrideDateChange={(v) => patchForm({ overrideDate: v })}
              onOverrideClosedChange={(v) => patchForm({ overrideClosed: v })}
              onOverrideOpenChange={(v) => patchForm({ overrideOpen: v })}
              onOverrideCloseChange={(v) => patchForm({ overrideClose: v })}
              onAddOverride={addOverride}
              onRemoveOverride={removeOverride}
            />
            <Holidays
              holidays={form.holidays}
              holidayDate={form.holidayDate}
              holidayName={form.holidayName}
              holidayClosed={form.holidayClosed}
              onDateChange={(v) => patchForm({ holidayDate: v })}
              onNameChange={(v) => patchForm({ holidayName: v })}
              onClosedChange={(v) => patchForm({ holidayClosed: v })}
              onAdd={addHoliday}
              onRemove={removeHoliday}
            />
            <CalendarIntegrationsCard />
          </div>

          <div className="space-y-5 xl:sticky xl:top-6">
            <AvailabilitySummary items={summary} />
            <LivePreview days={previewDays} />
            <SlotDiagnostics form={form} />
          </div>
        </div>

        <div className="avail-card avail-fade-in avail-fade-in-3 mt-6 flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <p className="text-[12.5px] text-[#8a87a0]">
            Changes apply immediately to all booking channels.
            {saved ? (
              <span className="ml-1.5 inline-flex items-center gap-1 font-medium text-[#16a05a]">Saved.</span>
            ) : null}
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="avail-btn-ghost"
              onClick={() => {
                setForm(EMPTY_AVAILABILITY_FORM);
                setSaved(false);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="avail-btn-primary shadow-[0_1px_2px_rgba(91,69,224,0.25)] disabled:opacity-60 disabled:shadow-none"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save availability"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
