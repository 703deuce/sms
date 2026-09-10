"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AvailabilityView from "@/components/appointments/kimi-ui/availability/page";
import {
  buildAvailabilityPageModel,
  buildSettingsPatch,
  EMPTY_AVAILABILITY_FORM,
  formStateFromSettings,
} from "@/features/appointments/kimi/availability/map-availability";
import type {
  AvailabilityFormState,
  AvailabilityPageActions,
  AvailabilityPageModel,
} from "@/features/appointments/kimi/availability/types";
import type { AppointmentPlatformConfig } from "@/lib/appointments/types";
import { SchedulingRulesSection } from "@/features/appointments/kimi/availability/SchedulingRulesSection";
import { SchedulePreferencesSection } from "@/features/appointments/kimi/availability/SchedulePreferencesSection";
import { SpecialDatesSection } from "@/features/appointments/kimi/availability/SpecialDatesSection";
import { SlotDiagnosticsPanel } from "@/features/appointments/kimi/availability/SlotDiagnosticsPanel";

function AvailabilityLoading() {
  return (
    <div className="avail-page min-h-full bg-[#f7f6fb] p-8 font-sans animate-pulse">
      <div className="max-w-[1240px] mx-auto space-y-5">
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-40 rounded-xl bg-white border border-[#eceaf3]" />
        <div className="h-72 rounded-xl bg-white border border-[#eceaf3]" />
      </div>
    </div>
  );
}

function AvailabilityError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="avail-page min-h-full bg-[#f7f6fb] p-8 font-sans flex items-center justify-center">
      <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load availability</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while fetching your booking rules and weekly hours.
        </p>
        <Button size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function AvailabilityConnected() {
  const [form, setForm] = useState<AvailabilityFormState>(EMPTY_AVAILABILITY_FORM);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [calendarSummary, setCalendarSummary] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/appointments/settings");
      if (!res.ok) throw new Error("settings failed");
      const json = await res.json();
      setForm(formStateFromSettings((json.data || {}) as AppointmentPlatformConfig));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    void fetch("/api/integrations/calendars")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        const connections = (json.data || []).filter((c: { provider?: string; config?: { blockingCalendarIds?: string[] } }) =>
          ["google", "microsoft"].includes(String(c.provider || "")),
        );
        const blocking = connections
          .filter((c: { config?: { blockingCalendarIds?: string[] } }) => (c.config?.blockingCalendarIds?.length ?? 0) > 0)
          .map((c: { provider: string; name?: string }) => `${c.provider === "google" ? "Google Calendar" : "Microsoft Outlook"}${c.name ? ` — ${c.name}` : ""}`);
        setCalendarSummary(blocking.length ? `Blocking events from: ${blocking.join(", ")}` : undefined);
      })
      .catch(() => setCalendarSummary(undefined));
  }, []);

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
        : {
            date: prev.overrideDate,
            windows: [{ open: prev.overrideOpen, close: prev.overrideClose }],
          };
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

  const save = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSettingsPatch(form)),
    });
    setSaving(false);
    if (!res.ok) return;
    setSaved(true);
  }, [form]);

  const model: AvailabilityPageModel | null = useMemo(() => {
    if (loading || failed) return null;
    return buildAvailabilityPageModel(form, { saving, saved });
  }, [failed, form, loading, saved, saving]);

  const actions: AvailabilityPageActions = useMemo(
    () => ({
      onTimezoneChange: (value) => patchForm({ timezone: value }),
      onMinimumNoticeChange: (value) => patchForm({ minimumNotice: value }),
      onMaximumDaysChange: (value) => patchForm({ maximumDays: value }),
      onUpdateWindow: updateWindow,
      onAddWindow: addWindow,
      onRemoveWindow: removeWindow,
      onOverrideDateChange: (value) => patchForm({ overrideDate: value }),
      onOverrideClosedChange: (value) => patchForm({ overrideClosed: value }),
      onOverrideOpenChange: (value) => patchForm({ overrideOpen: value }),
      onOverrideCloseChange: (value) => patchForm({ overrideClose: value }),
      onAddOverride: addOverride,
      onRemoveOverride: removeOverride,
      onSave: save,
      onRetry: load,
    }),
    [addOverride, addWindow, load, patchForm, removeOverride, removeWindow, save, updateWindow],
  );

  if (loading) return <AvailabilityLoading />;
  if (failed || !model) return <AvailabilityError onRetry={load} />;

  return (
    <div>
      <AvailabilityView model={model} actions={actions} />
      <div className="max-w-[1280px] mx-auto px-10 pb-10 space-y-6">
        <SpecialDatesSection form={form} onPatch={patchForm} onSave={save} saving={saving} />
        <SchedulingRulesSection
          form={form}
          onPatch={patchForm}
          onSave={save}
          saving={saving}
          saved={saved}
        />
        <SchedulePreferencesSection
          form={form}
          onPatch={patchForm}
          onSave={save}
          saving={saving}
          saved={saved}
          blockingCalendarSummary={calendarSummary}
        />
        <div className="avail-card p-6 space-y-4">
          <h2 className="text-[15px] font-bold">Workspace booking limits</h2>
          <p className="text-[12px] text-[#8a87a0]">
            Optional caps applied across all appointment types unless overridden per type.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Max bookings per day</label>
              <input
                type="number"
                className="input w-full mt-1"
                min={0}
                value={form.maxBookingsPerDay ?? ""}
                onChange={(e) =>
                  patchForm({
                    maxBookingsPerDay: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div>
              <label className="label">Max bookings per week</label>
              <input
                type="number"
                className="input w-full mt-1"
                min={0}
                value={form.maxBookingsPerWeek ?? ""}
                onChange={(e) =>
                  patchForm({
                    maxBookingsPerWeek: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div>
              <label className="label">Max per type per day</label>
              <input
                type="number"
                className="input w-full mt-1"
                min={0}
                value={form.maxPerTypePerDay ?? ""}
                onChange={(e) =>
                  patchForm({
                    maxPerTypePerDay: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : saved ? "Saved" : "Save limits"}
            </Button>
          </div>
        </div>
        <div className="avail-card p-6 space-y-4">
          <h2 className="text-[15px] font-bold">Named availability schedules</h2>
          <p className="text-[12px] text-[#8a87a0]">
            Reusable hour templates you can assign to appointment types.
          </p>
          {form.namedSchedules.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No named schedules yet.</p>
          ) : (
            <ul className="space-y-2">
              {form.namedSchedules.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-[13px]">
                  <span>{s.name}{s.isDefault ? " (default)" : ""}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patchForm({
                        namedSchedules: form.namedSchedules.filter((x) => x.id !== s.id),
                      })
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              patchForm({
                namedSchedules: [
                  ...form.namedSchedules,
                  {
                    id: `sched_${Date.now()}`,
                    name: `Schedule ${form.namedSchedules.length + 1}`,
                    weeklyHours: form.weeklyHours,
                    timezone: form.timezone,
                  },
                ],
              })
            }
          >
            Add schedule from current hours
          </Button>
        </div>
        <SlotDiagnosticsPanel />
      </div>
    </div>
  );
}
