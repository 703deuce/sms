"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, MapPin } from "lucide-react";
import { useLocationDetail } from "@/features/appointments/kimi/locations/use-locations-workspace";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "services", label: "Services" },
  { id: "staff", label: "Staff" },
  { id: "scheduling", label: "Scheduling" },
  { id: "resources", label: "Resources" },
  { id: "customer", label: "Customer experience" },
  { id: "appointments", label: "Appointments" },
  { id: "advanced", label: "Advanced" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

export function LocationDetailConnected({ locationId }: { locationId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as SectionId) || "overview";
  const detail = useLocationDetail(locationId);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [deactivateWarn, setDeactivateWarn] = useState<number | null>(null);

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/locations/${locationId}?${q.toString()}`, { scroll: false });
    },
    [router, searchParams, locationId],
  );

  const loc = detail.data?.location;

  async function saveBasics() {
    if (!loc) return;
    try {
      await detail.patch({
        location: {
          name: draft.name ?? loc.name,
          address: draft.address ?? loc.address,
          timezone: draft.timezone ?? loc.timezone,
          kind: (draft.kind as typeof loc.kind) ?? loc.kind,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function toggleService(typeId: string, assigned: boolean) {
    if (!detail.data) return;
    const ids = detail.data.services.filter((s) => s.assigned).map((s) => s.id);
    const next = assigned ? ids.filter((id) => id !== typeId) : [...ids, typeId];
    await detail.patch({ appointmentTypeIds: next });
  }

  async function toggleStaff(staffId: string, assigned: boolean) {
    if (!detail.data) return;
    const ids = detail.data.staff.filter((s) => s.assigned).map((s) => s.id);
    const next = assigned ? ids.filter((id) => id !== staffId) : [...ids, staffId];
    await detail.patch({ staffIds: next });
  }

  async function deactivate(force = false) {
    try {
      await detail.patch({ deactivate: true, forceDeactivate: force });
      setDeactivateWarn(null);
    } catch (e) {
      const err = e as Error & { code?: string; futureAppointmentCount?: number };
      if (err.code === "future_appointments") setDeactivateWarn(err.futureAppointmentCount || 0);
      else setError(err.message);
    }
  }

  if (detail.loading) {
    return <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}><div className="h-40 animate-pulse rounded bg-[var(--surface)]" /></div>;
  }

  if (!detail.data || !loc) {
    return (
      <div className={`${SHELL} p-8 text-sm`}>
        {detail.error || "Location not found"}{" "}
        <Link href="/appointments/locations" className="text-[var(--accent)]">Back</Link>
      </div>
    );
  }

  const d = detail.data;
  const bookPreview = d.workspaceSlug ? `/book/${encodeURIComponent(d.workspaceSlug)}` : "/book";

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <Link href="/appointments/locations" className="text-xs text-[var(--accent)]">← Locations</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="ws-icon-tile"><MapPin className="h-4 w-4" /></span>
              <div>
                <h1 className="ws-event-title">{loc.name}</h1>
                <p className="text-xs text-[var(--text-muted)]">{d.typeLabel} · {d.addressLabel}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="ws-chip">{loc.active === false ? "Inactive" : "Active"}</span>
                  <span className="ws-chip">{d.services.filter((s) => s.assigned).length} services</span>
                  <span className="ws-chip">{d.staff.filter((s) => s.assigned).length} staff</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={bookPreview} target="_blank" rel="noreferrer" className="appt-pilot-secondary-btn text-xs">
                <ExternalLink className="mr-1 inline h-3.5 w-3.5" /> Preview booking
              </a>
            </div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto border-t border-[var(--border)] pt-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`whitespace-nowrap rounded px-3 py-1.5 text-xs ${section === s.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </header>

        {error && <p className="px-4 py-2 text-sm text-red-600 lg:px-6">{error}</p>}

        <div className="p-4 lg:p-6 text-xs">
          {section === "overview" && (
            <div className="grid grid-cols-12 gap-3">
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-7">
                <h2 className="font-semibold">Location details</h2>
                <p className="mt-2">{d.typeLabel}</p>
                <p className="text-[var(--text-muted)]">{d.addressLabel}</p>
                <p className="mt-1">Timezone: {d.scheduling.timezone}</p>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-5">
                <h2 className="font-semibold">Setup health</h2>
                <ul className="mt-2 space-y-1">
                  {d.setupHealth.map((h) => (
                    <li key={h.id} className="flex justify-between">
                      <span>{h.label}</span>
                      <span>{h.ok ? "✓" : "—"} {h.detail}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-5">
                <h2 className="font-semibold">Customer preview</h2>
                <p className="mt-2 font-medium uppercase tracking-wide">{d.customerPreview.title}</p>
                {d.customerPreview.lines.map((line, i) => (
                  <p key={i} className="text-[var(--text-muted)]">{line}</p>
                ))}
              </section>
            </div>
          )}

          {section === "services" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[800px] text-left">
                <thead className="border-b text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Staff here</th>
                    <th className="px-3 py-2">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {d.services.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2">{s.durationMinutes} min</td>
                      <td className="px-3 py-2">{s.staffAtLocation}</td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={s.assigned} onChange={(e) => void toggleService(s.id, s.assigned)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === "staff" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[700px]">
                <thead className="border-b text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {d.staff.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2">{s.title || "—"}</td>
                      <td className="px-3 py-2">{s.status}</td>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={s.assigned} onChange={(e) => void toggleStaff(s.id, s.assigned)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === "scheduling" && (
            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <h2 className="font-semibold">Weekly hours</h2>
                <p className="text-[var(--text-muted)]">{d.scheduling.usesCustomHours ? "Location-specific" : "Business default"}</p>
                <ul className="mt-2 space-y-0.5 font-mono text-[11px]">
                  {d.scheduling.hoursSummary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <Link href={d.scheduling.availabilityHref} className="mt-3 inline-block text-[var(--accent)]">
                  Open full Availability
                </Link>
              </section>
            </div>
          )}

          {section === "resources" && (
            <div>
              <Link href={`/appointments/resources?locationId=${locationId}`} className="appt-pilot-primary-btn mb-3 inline-flex">
                Manage resources
              </Link>
              <ul className="space-y-2">
                {d.resources.map((r) => (
                  <li key={r.id} className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                    {r.name} {r.linked ? "· linked" : ""}
                  </li>
                ))}
                {!d.resources.length && <li className="text-[var(--text-muted)]">No resources linked.</li>}
              </ul>
            </div>
          )}

          {section === "customer" && (
            <div className="max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-semibold">Public preview</h2>
              <p className="mt-2 font-medium">{d.customerPreview.title}</p>
              {d.customerPreview.lines.map((l, i) => (
                <p key={i} className="text-[var(--text-muted)]">{l}</p>
              ))}
              {loc.address && loc.kind !== "customer" && loc.kind !== "video" && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(loc.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-[var(--accent)]"
                >
                  Get directions
                </a>
              )}
            </div>
          )}

          {section === "appointments" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[800px]">
                <thead className="border-b text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2">When</th>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.appointments.map((a) => (
                    <tr key={a.id} className="border-b">
                      <td className="px-3 py-2">{fmt(a.startsAt)}</td>
                      <td className="px-3 py-2">{a.serviceName}</td>
                      <td className="px-3 py-2">{a.staffName || "—"}</td>
                      <td className="px-3 py-2">{a.status}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/appointments/${a.id}`} className="text-[var(--accent)]">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {section === "advanced" && (
            <div className="max-w-lg space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <label className="block">
                Name
                <input className="mt-1 w-full rounded border px-2 py-1.5" value={draft.name ?? loc.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label className="block">
                Address
                <input className="mt-1 w-full rounded border px-2 py-1.5" value={draft.address ?? loc.address ?? ""} onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))} />
              </label>
              <button type="button" className="appt-pilot-primary-btn" onClick={() => void saveBasics()}>Save changes</button>
              <hr />
              <button type="button" className="appt-pilot-secondary-btn text-red-600" onClick={() => void deactivate()}>
                Deactivate location
              </button>
              {deactivateWarn !== null && (
                <div className="rounded border border-amber-200 bg-amber-50 p-3">
                  <p>{deactivateWarn} future appointments. Stop new bookings only?</p>
                  <button type="button" className="mt-2 appt-pilot-primary-btn" onClick={() => void deactivate(true)}>Deactivate anyway</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
