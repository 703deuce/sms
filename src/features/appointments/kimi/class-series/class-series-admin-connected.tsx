"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CLASS_SERIES_OFFERING_UI,
  metadataForOfferingKind,
  resolveClassSeriesOfferingKind,
  type ClassSeriesOfferingKind,
} from "@/lib/appointments/class-series-offering";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

type ClassSeriesRow = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  staffId: string | null;
  locationId: string | null;
  active: boolean;
  metadata: unknown;
  occurrences?: Array<{ id: string; startsAt: string; endsAt: string }>;
};

type ClassSeriesForm = {
  name: string;
  description: string;
  capacity: number;
  staffId: string;
  locationId: string;
  active: boolean;
};

const EMPTY_FORM: ClassSeriesForm = {
  name: "",
  description: "",
  capacity: 10,
  staffId: "",
  locationId: "",
  active: true,
};

function LoadingShell({ title }: { title: string }) {
  return (
    <div className="reference-root min-h-screen bg-[#f7f8fa] p-6 font-sans animate-pulse">
      <div className="h-8 w-64 rounded bg-gray-200 mb-6" />
      <p className="text-sm text-[#8a8fa3]">Loading {title}…</p>
    </div>
  );
}

export function ClassSeriesAdminConnected({
  offeringKind,
}: {
  offeringKind: ClassSeriesOfferingKind;
}) {
  const copy = CLASS_SERIES_OFFERING_UI[offeringKind];
  const [rows, setRows] = useState<ClassSeriesRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [locationOptions, setLocationOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<ClassSeriesForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [classesRes, settingsRes] = await Promise.all([
        fetch("/api/appointments/service-booking/classes"),
        fetch("/api/appointments/settings"),
      ]);
      if (!classesRes.ok) throw new Error("classes failed");
      const classesJson = await classesRes.json();
      const all = (classesJson.data || []) as ClassSeriesRow[];
      setRows(
        all.filter((row) => resolveClassSeriesOfferingKind(row.metadata) === offeringKind),
      );
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        const staff = (settingsJson.data?.staff || []) as Array<{ id: string; name: string; active?: boolean }>;
        const locations = (settingsJson.data?.locations || []) as Array<{ id: string; name: string; active?: boolean }>;
        setStaffOptions(staff.filter((s) => s.active !== false && s.name).map((s) => ({ id: s.id, name: s.name })));
        setLocationOptions(
          locations.filter((l) => l.active !== false && l.name).map((l) => ({ id: l.id, name: l.name })),
        );
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [offeringKind]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => !q || row.name.toLowerCase().includes(q));
  }, [rows, searchQuery]);

  useEffect(() => {
    if (!loading && visibleRows.length > 0 && !selectedId && !isCreating) {
      const first = visibleRows[0];
      setSelectedId(first.id);
      setForm({
        name: first.name,
        description: first.description || "",
        capacity: first.capacity,
        staffId: first.staffId || "",
        locationId: first.locationId || "",
        active: first.active,
      });
    }
  }, [visibleRows, isCreating, loading, selectedId]);

  const selected = visibleRows.find((row) => row.id === selectedId) ?? null;

  const startCreate = () => {
    setSelectedId(null);
    setIsCreating(true);
    setForm(EMPTY_FORM);
    setError("");
  };

  const selectRow = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSelectedId(id);
    setIsCreating(false);
    setForm({
      name: row.name,
      description: row.description || "",
      capacity: row.capacity,
      staffId: row.staffId || "",
      locationId: row.locationId || "",
      active: row.active,
    });
    setError("");
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (form.capacity < 1) {
      setError("Capacity must be at least 1");
      return;
    }
    setSaving(true);
    setError("");
    const body = {
      id: isCreating ? undefined : selectedId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      capacity: form.capacity,
      staffId: form.staffId || undefined,
      locationId: form.locationId || undefined,
      active: form.active,
      metadata: metadataForOfferingKind(offeringKind),
    };
    const res = await fetch("/api/appointments/service-booking/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not save");
      setSaving(false);
      return;
    }
    const saved = json.data as ClassSeriesRow;
    setSaving(false);
    setIsCreating(false);
    setSelectedId(saved.id);
    await load();
  };

  if (loading) return <LoadingShell title={copy.pageTitle} />;
  if (failed) {
    return (
      <div className="reference-root min-h-screen bg-[#f7f8fa] p-6 font-sans flex items-center justify-center">
        <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
          <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#dcefeb] text-[#147d74]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load {copy.pageTitle.toLowerCase()}</h3>
          <Button size="sm" className="mt-5" onClick={() => void load()}>Try again</Button>
        </div>
      </div>
    );
  }

  const nextOccurrence = selected?.occurrences?.[0];
  const nextOccurrenceLabel = nextOccurrence
    ? new Date(nextOccurrence.startsAt).toLocaleString()
    : "—";

  return (
    <div className="reference-root">
      <div className="max-w-[1560px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-[24px] leading-[30px] font-bold tracking-tight text-[#1a1d29]">
              {copy.pageTitle}
            </h1>
            <p className="text-[13.5px] leading-[20px] text-[#8a8fa3] mt-1">{copy.pageDescription}</p>
          </div>
          <button
            type="button"
            className="btn-brand flex items-center gap-1.5 text-[13px] font-semibold h-9 px-4 rounded-lg shadow-sm"
            onClick={startCreate}
          >
            <Plus size={15} strokeWidth={2.5} /> {copy.createButtonLabel}
          </button>
        </div>

        <div className="flex gap-5 items-start">
          <div className="card flex flex-col w-[300px] shrink-0 overflow-hidden">
            <div className="p-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-[14.5px] font-semibold">{copy.listPanelTitle}</h2>
                <span className="text-[11px] font-semibold bg-[#eef0ff] text-[#5b4bff] rounded-full px-2 py-0.5">
                  {rows.length}
                </span>
              </div>
              <input
                className="input w-full text-[13px]"
                placeholder={`Search ${copy.pageTitle.toLowerCase()}…`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={`Search ${copy.pageTitle}`}
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
              {visibleRows.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12.5px] text-[#8a8fa3]">{copy.listEmptyMessage}</p>
              ) : (
                visibleRows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => selectRow(row.id)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 text-[13px] transition-colors ${
                      row.id === selectedId
                        ? "bg-[#f7f6ff] text-[#1a1d29] ring-1 ring-[#dcd9ff]"
                        : "hover:bg-[#fafbfc] text-[#3f4254]"
                    }`}
                  >
                    <div className="font-medium truncate">{row.name}</div>
                    <div className="text-[11.5px] text-[#8a8fa3] mt-0.5">
                      Capacity {row.capacity} · {row.active ? "Active" : "Inactive"}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="card flex-1 min-w-[440px] overflow-hidden flex flex-col">
            {!selected && !isCreating ? (
              <div className="p-12 text-center text-[13px] text-[#8a8fa3]">
                {copy.listEmptyMessage}
                <div className="mt-4">
                  <button type="button" className="btn-brand text-[13px] font-semibold h-9 px-4 rounded-lg" onClick={startCreate}>
                    {copy.createButtonLabel}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-5 py-3.5 border-b border-[#ecedf2] text-[13px] text-[#6b6f82]">
                  {copy.editorBackLabel}
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                  <section>
                    <h3 className="text-[14px] font-semibold mb-4">General</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor="series-name">Name</label>
                        <input
                          id="series-name"
                          className="input w-full"
                          value={form.name}
                          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor="series-description">Description</label>
                        <textarea
                          id="series-description"
                          className="input w-full min-h-[80px]"
                          value={form.description}
                          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="series-capacity">Maximum capacity</label>
                        <input
                          id="series-capacity"
                          type="number"
                          min={1}
                          className="input w-full"
                          value={form.capacity}
                          onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) || 1 }))}
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor="series-active">Status</label>
                        <select
                          id="series-active"
                          className="input w-full"
                          value={form.active ? "active" : "inactive"}
                          onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "active" }))}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-[14px] font-semibold mb-4">
                      {offeringKind === "workshop" ? "Instructor & location" : "Instructor & location"}
                    </h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="series-staff">Instructor / staff</label>
                        <select
                          id="series-staff"
                          className="input w-full"
                          value={form.staffId}
                          onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}
                        >
                          <option value="">Select staff</option>
                          {staffOptions.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor="series-location">Location</label>
                        <select
                          id="series-location"
                          className="input w-full"
                          value={form.locationId}
                          onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}
                        >
                          <option value="">Select location</option>
                          {locationOptions.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  {offeringKind === "class" && selected ? (
                    <section>
                      <h3 className="text-[14px] font-semibold mb-2">Schedule</h3>
                      <p className="text-[12.5px] text-[#8a8fa3]">
                        Next occurrence: {nextOccurrenceLabel}. Manage occurrences from Calendar or class operations.
                      </p>
                    </section>
                  ) : null}

                  {error ? (
                    <p className="text-[13px] text-red-600" role="alert">{error}</p>
                  ) : null}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      className="btn-brand text-[13px] font-semibold h-9 px-4 rounded-lg disabled:opacity-50"
                      onClick={() => void save()}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
