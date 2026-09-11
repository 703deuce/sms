"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CLASS_EDITOR_SECTIONS,
  CLASS_SERIES_OFFERING_UI,
  WORKSHOP_EDITOR_SECTIONS,
  metadataForOfferingKind,
  parseClassSeriesMetadata,
  resolveClassSeriesOfferingKind,
  type ClassSeriesMetadata,
  type ClassSeriesOfferingKind,
} from "@/lib/appointments/class-series-offering";
import { ClassSeriesOccurrencePanel } from "./class-series-occurrence-panel";
import { ClassSeriesWorkshopSchedulePanel } from "./class-series-workshop-schedule-panel";
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
  occurrences?: Array<{ id: string; startsAt: string; endsAt: string; capacity?: number | null }>;
};

type ClassSeriesForm = {
  name: string;
  description: string;
  capacity: number;
  staffId: string;
  locationId: string;
  active: boolean;
  metadata: ClassSeriesMetadata;
};

const EMPTY_FORM: ClassSeriesForm = {
  name: "",
  description: "",
  capacity: 10,
  staffId: "",
  locationId: "",
  active: true,
  metadata: {},
};

function LoadingShell({ title }: { title: string }) {
  return (
    <div className="reference-root min-h-screen bg-[#f7f8fa] p-6 font-sans animate-pulse">
      <div className="h-8 w-64 rounded bg-gray-200 mb-6" />
      <p className="text-sm text-[#8a8fa3]">Loading {title}…</p>
    </div>
  );
}

function rowToForm(row: ClassSeriesRow, kind: ClassSeriesOfferingKind): ClassSeriesForm {
  const meta = metadataForOfferingKind(kind, parseClassSeriesMetadata(row.metadata));
  return {
    name: row.name,
    description: row.description || "",
    capacity: row.capacity,
    staffId: row.staffId || "",
    locationId: row.locationId || "",
    active: row.active,
    metadata: meta,
  };
}

export function ClassSeriesAdminConnected({
  offeringKind,
}: {
  offeringKind: ClassSeriesOfferingKind;
}) {
  const copy = CLASS_SERIES_OFFERING_UI[offeringKind];
  const sections = offeringKind === "workshop" ? WORKSHOP_EDITOR_SECTIONS : CLASS_EDITOR_SECTIONS;
  const [rows, setRows] = useState<ClassSeriesRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [locationOptions, setLocationOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [intakeForms, setIntakeForms] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<ClassSeriesForm>({
    ...EMPTY_FORM,
    metadata: metadataForOfferingKind(offeringKind),
  });
  const [activeSection, setActiveSection] = useState<string>(sections[0]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [bookingSlug, setBookingSlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [classesRes, settingsRes, intakeRes, platformRes] = await Promise.all([
        fetch("/api/appointments/service-booking/classes"),
        fetch("/api/appointments/settings"),
        fetch("/api/appointments/service-booking/intake-forms"),
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
      if (intakeRes.ok) {
        const intakeJson = await intakeRes.json();
        setIntakeForms(
          (intakeJson.data || []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })),
        );
      }
      if (platformRes.ok) {
        const platformJson = await platformRes.json();
        const slug = platformJson.data?.publicBookingSlug || platformJson.data?.slug;
        if (slug) setBookingSlug(String(slug));
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
      setForm(rowToForm(first, offeringKind));
    }
  }, [visibleRows, isCreating, loading, selectedId, offeringKind]);

  const selected = visibleRows.find((row) => row.id === selectedId) ?? null;

  const startCreate = () => {
    setSelectedId(null);
    setIsCreating(true);
    setForm({ ...EMPTY_FORM, metadata: metadataForOfferingKind(offeringKind) });
    setActiveSection(sections[0]);
    setError("");
  };

  const selectRow = (id: string) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSelectedId(id);
    setIsCreating(false);
    setForm(rowToForm(row, offeringKind));
    setError("");
  };

  const updateMeta = (patch: Partial<ClassSeriesMetadata>) => {
    setForm((f) => ({ ...f, metadata: { ...f.metadata, ...patch } }));
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
      metadata: metadataForOfferingKind(offeringKind, form.metadata),
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

  const sectionLabel = (id: string) => {
    const labels: Record<string, string> = {
      general: "General",
      schedule: "Schedule",
      datetime: "Date & time",
      instructor: "Instructor & location",
      location: "Location",
      capacity: "Capacity",
      registration: "Registration",
      pricing: "Pricing & access",
      customer: "Customer information",
      policies: offeringKind === "workshop" ? "Policies & documents" : "Policies",
      waitlist: "Waitlist",
      admission: "Admission",
      confirmation: "Confirmation",
    };
    return labels[id] || id;
  };

  const publicHref = bookingSlug
    ? `/book/${bookingSlug}/${copy.publicPathSuffix}`
    : null;

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

  const nextOccurrence = selected?.occurrences?.find((o) => new Date(o.startsAt) >= new Date());
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
            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 max-h-[70vh]">
              {visibleRows.length === 0 ? (
                <p className="px-3 py-6 text-center text-[12.5px] text-[#8a8fa3]">{copy.listEmptyMessage}</p>
              ) : (
                visibleRows.map((row) => {
                  const next = row.occurrences?.[0];
                  return (
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
                        {next
                          ? `Next: ${new Date(next.startsAt).toLocaleDateString()}`
                          : "No upcoming session"}
                        {" · "}
                        Cap {row.capacity}
                      </div>
                    </button>
                  );
                })
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
                <div className="px-5 py-3 border-b border-[#ecedf2] flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] text-[#6b6f82]">{copy.editorBackLabel}</span>
                  {publicHref ? (
                    <Link
                      href={publicHref}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-[#147d74] hover:underline"
                    >
                      Public page <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </div>

                <div className="flex border-b border-[#ecedf2] overflow-x-auto px-2">
                  {sections.map((section) => (
                    <button
                      key={section}
                      type="button"
                      onClick={() => setActiveSection(section)}
                      className={`shrink-0 px-3 py-2.5 text-[12.5px] font-medium border-b-2 transition-colors ${
                        activeSection === section
                          ? "border-[#147d74] text-[#147d74]"
                          : "border-transparent text-[#6b6f82] hover:text-[#1a1d29]"
                      }`}
                    >
                      {sectionLabel(section)}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                  {activeSection === "general" && (
                    <section className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor="series-name">Name</label>
                        <input id="series-name" className="input w-full" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor="series-description">Description</label>
                        <textarea id="series-description" className="input w-full min-h-[80px]" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label" htmlFor="series-visibility">Visibility</label>
                        <select id="series-visibility" className="input w-full" value={form.metadata.visibility || "public"} onChange={(e) => updateMeta({ visibility: e.target.value as "public" | "hidden" })}>
                          <option value="public">Public</option>
                          <option value="hidden">Hidden</option>
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor="series-active">Status</label>
                        <select id="series-active" className="input w-full" value={form.active ? "active" : "inactive"} onChange={(e) => setForm((f) => ({ ...f, active: e.target.value === "active" }))}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor="series-image">Image URL</label>
                        <input id="series-image" className="input w-full" value={form.metadata.imageUrl || ""} onChange={(e) => updateMeta({ imageUrl: e.target.value })} placeholder="https://…" />
                      </div>
                    </section>
                  )}

                  {activeSection === "schedule" && selectedId && (
                    <ClassSeriesOccurrencePanel
                      seriesId={selectedId}
                      defaultCapacity={form.capacity}
                      timezone={form.metadata.timezone}
                    />
                  )}
                  {activeSection === "schedule" && !selectedId && (
                    <p className="text-[13px] text-[#8a8fa3]">Save the {offeringKind} first, then add schedule occurrences.</p>
                  )}

                  {activeSection === "datetime" && selectedId && (
                    <ClassSeriesWorkshopSchedulePanel
                      seriesId={selectedId}
                      defaultCapacity={form.capacity}
                      timezone={form.metadata.timezone}
                    />
                  )}
                  {activeSection === "datetime" && !selectedId && (
                    <p className="text-[13px] text-[#8a8fa3]">Save the workshop first, then set date and time.</p>
                  )}

                  {(activeSection === "instructor" || activeSection === "location") && (
                    <section className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="label" htmlFor="series-staff">Instructor / staff</label>
                        <select id="series-staff" className="input w-full" value={form.staffId} onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}>
                          <option value="">Select staff</option>
                          {staffOptions.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor="series-location">Location</label>
                        <select id="series-location" className="input w-full" value={form.locationId} onChange={(e) => setForm((f) => ({ ...f, locationId: e.target.value }))}>
                          <option value="">Select location</option>
                          {locationOptions.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label" htmlFor="series-tz">Timezone</label>
                        <input id="series-tz" className="input w-full" value={form.metadata.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone} onChange={(e) => updateMeta({ timezone: e.target.value })} />
                      </div>
                    </section>
                  )}

                  {activeSection === "capacity" && (
                    <section className="grid gap-4 sm:grid-cols-2 max-w-md">
                      <div>
                        <label className="label" htmlFor="series-capacity">Maximum capacity</label>
                        <input id="series-capacity" type="number" min={1} className="input w-full" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) || 1 }))} />
                        <p className="mt-1 text-[12px] text-[#8a8fa3]">Enforced server-side at registration.</p>
                      </div>
                      <div className="flex items-center gap-2 pt-6">
                        <input id="show-remaining" type="checkbox" checked={form.metadata.showRemainingSpots !== false} onChange={(e) => updateMeta({ showRemainingSpots: e.target.checked })} />
                        <label htmlFor="show-remaining" className="text-[13px]">Show remaining spots on public page</label>
                      </div>
                    </section>
                  )}

                  {activeSection === "registration" && (
                    <section className="grid gap-4 sm:grid-cols-2 max-w-lg">
                      <div>
                        <label className="label" htmlFor="reg-capacity">Maximum capacity</label>
                        <input
                          id="reg-capacity"
                          type="number"
                          min={1}
                          className="input w-full"
                          value={form.capacity}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, capacity: Number(e.target.value) || 1 }))
                          }
                        />
                        <p className="mt-1 text-[12px] text-[#8a8fa3]">Enforced server-side at registration.</p>
                      </div>
                      <div>
                        <label className="label" htmlFor="reg-opens">Registration opens</label>
                        <input id="reg-opens" type="datetime-local" className="input w-full" value={form.metadata.registrationOpensAt?.slice(0, 16) || ""} onChange={(e) => updateMeta({ registrationOpensAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
                      </div>
                      <div>
                        <label className="label" htmlFor="reg-closes">Registration closes</label>
                        <input id="reg-closes" type="datetime-local" className="input w-full" value={form.metadata.registrationClosesAt?.slice(0, 16) || ""} onChange={(e) => updateMeta({ registrationClosesAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
                      </div>
                      <p className="sm:col-span-2 text-[12px] text-[#8a8fa3]">Next session: {nextOccurrenceLabel}</p>
                    </section>
                  )}

                  {activeSection === "pricing" && (
                    <section className="grid gap-4 sm:grid-cols-2 max-w-lg">
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <input id="is-free" type="checkbox" checked={form.metadata.isFree === true} onChange={(e) => updateMeta({ isFree: e.target.checked, priceCents: e.target.checked ? 0 : form.metadata.priceCents })} />
                        <label htmlFor="is-free" className="text-[13px]">Free</label>
                      </div>
                      {!form.metadata.isFree && (
                        <div>
                          <label className="label" htmlFor="price">Price (USD)</label>
                          <input id="price" type="number" min={0} step="0.01" className="input w-full" value={(form.metadata.priceCents ?? 0) / 100} onChange={(e) => updateMeta({ priceCents: Math.round(Number(e.target.value) * 100) })} />
                        </div>
                      )}
                      <div className="flex items-center gap-2 sm:col-span-2">
                        <input id="member-only" type="checkbox" checked={form.metadata.memberOnly === true} onChange={(e) => updateMeta({ memberOnly: e.target.checked })} />
                        <label htmlFor="member-only" className="text-[13px]">Members only</label>
                      </div>
                      <p className="sm:col-span-2 text-[12px] text-[#8a8fa3]">
                        Package and membership eligibility use canonical commerce settings at checkout when configured.
                      </p>
                    </section>
                  )}

                  {activeSection === "customer" && (
                    <section className="max-w-md">
                      <label className="label" htmlFor="intake-form">Intake form</label>
                      <select id="intake-form" className="input w-full" value={form.metadata.intakeFormId || ""} onChange={(e) => updateMeta({ intakeFormId: e.target.value || undefined })}>
                        <option value="">None</option>
                        {intakeForms.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      <p className="mt-2 text-[12px] text-[#8a8fa3]">
                        <Link href="/appointments/booking/forms" className="text-[#147d74] underline">Manage forms</Link>
                      </p>
                    </section>
                  )}

                  {activeSection === "policies" && (
                    <section className="grid gap-4 max-w-lg">
                      <div>
                        <label className="label" htmlFor="cancel-policy">Cancellation policy</label>
                        <textarea id="cancel-policy" className="input w-full min-h-[72px]" value={form.metadata.cancellationPolicy || ""} onChange={(e) => updateMeta({ cancellationPolicy: e.target.value })} />
                      </div>
                      <div>
                        <label className="label" htmlFor="terms-url">Terms URL</label>
                        <input id="terms-url" className="input w-full" value={form.metadata.termsUrl || ""} onChange={(e) => updateMeta({ termsUrl: e.target.value })} />
                      </div>
                    </section>
                  )}

                  {activeSection === "waitlist" && (
                    <section className="grid gap-4 max-w-lg">
                      <div className="flex items-center gap-2">
                        <input id="waitlist-enabled" type="checkbox" checked={form.metadata.waitlistEnabled === true} onChange={(e) => updateMeta({ waitlistEnabled: e.target.checked })} />
                        <label htmlFor="waitlist-enabled" className="text-[13px]">Enable waitlist when full</label>
                      </div>
                      {form.metadata.waitlistEnabled && (
                        <>
                          <div className="flex items-center gap-2">
                            <input id="waitlist-auto" type="checkbox" checked={form.metadata.waitlistAutoPromote === true} onChange={(e) => updateMeta({ waitlistAutoPromote: e.target.checked })} />
                            <label htmlFor="waitlist-auto" className="text-[13px]">Automatically promote when a spot opens</label>
                          </div>
                          <div>
                            <label className="label" htmlFor="waitlist-expire">Offer expires (hours)</label>
                            <input id="waitlist-expire" type="number" min={1} className="input w-full max-w-[120px]" value={form.metadata.waitlistOfferExpiresHours ?? 24} onChange={(e) => updateMeta({ waitlistOfferExpiresHours: Number(e.target.value) || 24 })} />
                          </div>
                        </>
                      )}
                      <p className="text-[12px] text-[#8a8fa3]">
                        Waitlist runtime uses the shared appointments waitlist engine.{" "}
                        <Link href="/appointments/waitlist" className="text-[#147d74] underline">View waitlist</Link>
                      </p>
                    </section>
                  )}

                  {activeSection === "admission" && (
                    <section className="max-w-lg space-y-3">
                      <div className="flex items-center gap-2">
                        <input id="admission-enabled" type="checkbox" checked={form.metadata.admissionEnabled === true} onChange={(e) => updateMeta({ admissionEnabled: e.target.checked })} />
                        <label htmlFor="admission-enabled" className="text-[13px]">Enable check-in / ticket tracking</label>
                      </div>
                      <p className="text-[12px] text-[#8a8fa3]">
                        After registrations exist, manage attendance from Calendar or class operations. Seat maps remain available per occurrence when configured.
                      </p>
                    </section>
                  )}

                  {activeSection === "confirmation" && (
                    <section className="max-w-lg">
                      <label className="label" htmlFor="confirm-msg">Confirmation message</label>
                      <textarea id="confirm-msg" className="input w-full min-h-[100px]" value={form.metadata.confirmationMessage || ""} onChange={(e) => updateMeta({ confirmationMessage: e.target.value })} placeholder="Instructions shown after registration…" />
                    </section>
                  )}

                  {error ? <p className="text-[13px] text-red-600" role="alert">{error}</p> : null}

                  <div className="flex gap-2 pt-2 border-t border-[#ecedf2]">
                    <button type="button" className="btn-brand text-[13px] font-semibold h-9 px-4 rounded-lg disabled:opacity-50" onClick={() => void save()} disabled={saving}>
                      {saving ? "Saving…" : isCreating ? copy.createButtonLabel : "Save changes"}
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
