"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Box } from "lucide-react";
import { useResourceDetail } from "@/features/appointments/kimi/resources/use-resources-workspace";
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
  { id: "scheduling", label: "Scheduling" },
  { id: "bookings", label: "Bookings" },
  { id: "advanced", label: "Advanced" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function fmt(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ResourceDetailConnected({ resourceId }: { resourceId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as SectionId) || "overview";
  const detail = useResourceDetail(resourceId);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Record<string, string | number>>({});
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignDraft, setAssignDraft] = useState<Set<string>>(new Set());
  const [deactivateWarn, setDeactivateWarn] = useState<number | null>(null);
  const [capacityWarn, setCapacityWarn] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/resources/${resourceId}?${q.toString()}`, { scroll: false });
    },
    [router, searchParams, resourceId],
  );

  const r = detail.data?.resource;

  async function saveBasics() {
    if (!r) return;
    try {
      await detail.patch({
        name: (draft.name as string) ?? r.name,
        category: (draft.category as string) ?? r.category,
        quantity: draft.quantity != null ? Number(draft.quantity) : r.quantity,
        description: draft.description != null ? String(draft.description) : r.description,
      });
      setCapacityWarn(null);
    } catch (e) {
      const err = e as Error & { code?: string; peakUsage?: number };
      if (err.code === "capacity_conflict") setCapacityWarn(err.peakUsage || 0);
      else setError(err.message);
    }
  }

  async function saveServices(ids: string[]) {
    try {
      await detail.patch({ eligibleTypeIds: ids });
      setAssignOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function deactivate(force = false) {
    try {
      await detail.patch({ deactivate: true, forceDeactivate: force });
      setDeactivateWarn(null);
    } catch (e) {
      const err = e as Error & { code?: string; futureReservationCount?: number };
      if (err.code === "future_reservations") setDeactivateWarn(err.futureReservationCount || 0);
      else setError(err.message);
    }
  }

  async function runTest() {
    if (!r) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const starts = new Date();
      starts.setHours(14, 0, 0, 0);
      const ends = new Date(starts.getTime() + 60 * 60 * 1000);
      const result = await detail.testAvailability({
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
      });
      setTestResult(
        `${result.result}: ${result.available} / ${result.capacity} available (${result.reserved} reserved)`,
      );
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTestLoading(false);
    }
  }

  if (detail.loading) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="h-40 animate-pulse rounded bg-[var(--surface)]" />
      </div>
    );
  }

  if (!detail.data || !r) {
    return (
      <div className={`${SHELL} p-8 text-sm`}>
        {detail.error || "Resource not found"}{" "}
        <Link href="/appointments/resources" className="text-[var(--accent)]">Back</Link>
      </div>
    );
  }

  const d = detail.data;
  const assignedServices = d.services.filter((s) => s.assigned);

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <Link href="/appointments/resources" className="text-xs text-[var(--accent)]">← Resources</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <span className="ws-icon-tile"><Box className="h-4 w-4" /></span>
              <div>
                <h1 className="ws-event-title">{r.name}</h1>
                <p className="text-xs text-[var(--text-muted)]">{d.typeLabel} · {d.locationLabel}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="ws-chip">{r.active ? "Active" : "Inactive"}</span>
                  <span className="ws-chip">Capacity {r.quantity}</span>
                  <span className="ws-chip">{assignedServices.length} services</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/appointments/calendar" className="appt-pilot-secondary-btn text-xs">View bookings</Link>
              <button type="button" className="appt-pilot-primary-btn text-xs" onClick={() => void saveBasics()}>
                Save changes
              </button>
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
                <h2 className="font-semibold">Resource details</h2>
                <label className="mt-2 block">
                  Name
                  <input
                    className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1"
                    value={(draft.name as string) ?? r.name}
                    onChange={(e) => setDraft((x) => ({ ...x, name: e.target.value }))}
                  />
                </label>
                <label className="mt-2 block">
                  Type
                  <input
                    className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1"
                    value={(draft.category as string) ?? r.category}
                    onChange={(e) => setDraft((x) => ({ ...x, category: e.target.value }))}
                  />
                </label>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-5">
                <h2 className="font-semibold">Setup health</h2>
                <ul className="mt-2 space-y-1">
                  {d.setupHealth.map((h) => (
                    <li key={h.id} className="flex justify-between">
                      <span>{h.label}</span>
                      <span className={h.ok ? "text-emerald-700" : "text-amber-700"}>
                        {h.detail} {h.ok ? "✓" : "!"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <h2 className="font-semibold">Capacity</h2>
                <p className="mt-2">
                  {r.quantity > 1 ? `Quantity: ${r.quantity}` : `Capacity: ${r.quantity}`}
                </p>
                <p className="text-[var(--text-muted)]">
                  Now: {d.capacityNow.available} available ({d.capacityNow.inUse} in use)
                </p>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <h2 className="font-semibold">Services</h2>
                <p className="mt-2">{assignedServices.length} assigned</p>
                <button type="button" className="mt-2 text-[var(--accent)]" onClick={() => setSection("services")}>
                  Manage
                </button>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <h2 className="font-semibold">Location</h2>
                <p className="mt-2">{d.locationLabel}</p>
                <Link href="/appointments/locations" className="mt-2 inline-block text-[var(--accent)]">
                  Open locations
                </Link>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-7">
                <h2 className="font-semibold">Scheduling</h2>
                <p className="mt-2">{d.scheduling.summary}</p>
                <p className="text-[var(--text-muted)]">{d.scheduling.mode}</p>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-5">
                <h2 className="font-semibold">Upcoming reservations</h2>
                <p className="mt-2 text-2xl font-semibold">{d.futureReservationCount}</p>
                <button type="button" className="mt-2 text-[var(--accent)]" onClick={() => setSection("bookings")}>
                  View bookings
                </button>
              </section>
            </div>
          )}

          {section === "services" && (
            <div>
              <div className="mb-3 flex justify-between">
                <h2 className="font-semibold">Service requirements</h2>
                <button
                  type="button"
                  className="appt-pilot-secondary-btn"
                  onClick={() => {
                    setAssignDraft(new Set(assignedServices.map((s) => s.id)));
                    setAssignOpen(true);
                  }}
                >
                  Assign services
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                <table className="w-full min-w-[800px] text-left">
                  <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-2">Service</th>
                      <th className="px-3 py-2">Required</th>
                      <th className="px-3 py-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedServices.map((s) => (
                      <tr key={s.id} className="border-b border-[var(--border)]">
                        <td className="px-3 py-2">{s.name}</td>
                        <td className="px-3 py-2">Yes · 1 unit</td>
                        <td className="px-3 py-2">{s.durationMinutes} min</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {section === "scheduling" && (
            <div className="grid grid-cols-12 gap-3">
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <h2 className="font-semibold">Availability source</h2>
                <p className="mt-2">Uses location hours + capacity reservations</p>
                <p className="mt-1 text-[var(--text-muted)]">Custom per-resource hours: not configured (uses location intersection).</p>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-8">
                <h2 className="font-semibold">Capacity in use</h2>
                <p className="mt-2">
                  {d.capacityNow.inUse} / {d.capacityNow.quantity} reserved in the next 24h window
                </p>
              </section>
              <section className="col-span-12 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <h2 className="font-semibold">Test availability</h2>
                <p className="mt-1 text-[var(--text-muted)]">Uses the same engine as slot generation (today 2 PM, 1 hour).</p>
                <button
                  type="button"
                  className="appt-pilot-secondary-btn mt-2"
                  disabled={testLoading}
                  onClick={() => void runTest()}
                >
                  {testLoading ? "Testing…" : "Run test"}
                </button>
                {testResult && <p className="mt-2 font-medium">{testResult}</p>}
              </section>
            </div>
          )}

          {section === "bookings" && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[900px] text-left">
                <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2">Date / time</th>
                    <th className="px-3 py-2">Service</th>
                    <th className="px-3 py-2">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {d.bookings.map((b) => (
                    <tr key={b.id} className="border-b border-[var(--border)]">
                      <td className="px-3 py-2">{fmt(b.startsAt)}</td>
                      <td className="px-3 py-2">{b.serviceName}</td>
                      <td className="px-3 py-2">{b.status}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/appointments/${b.appointmentId}`} className="text-[var(--accent)]">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!d.bookings.length && (
                <p className="p-4 text-[var(--text-muted)]">No booking lines linked to this resource yet.</p>
              )}
            </div>
          )}

          {section === "advanced" && (
            <div className="max-w-lg space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
              <label className="block">
                Capacity / quantity
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1"
                  value={draft.quantity ?? r.quantity}
                  onChange={(e) => setDraft((x) => ({ ...x, quantity: Number(e.target.value) }))}
                />
              </label>
              {capacityWarn != null && (
                <div className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
                  Peak usage is {capacityWarn}. Reducing capacity may overbook existing reservations.
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={() =>
                      void detail.patch({ quantity: Number(draft.quantity ?? r.quantity), forceCapacity: true })
                    }
                  >
                    Force reduce
                  </button>
                </div>
              )}
              {d.groups.filter((g) => g.member).length > 0 && (
                <div>
                  <p className="font-medium">Resource pools</p>
                  <ul className="mt-1 list-disc pl-4">
                    {d.groups.filter((g) => g.member).map((g) => (
                      <li key={g.id}>{g.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {deactivateWarn != null && (
                <div className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
                  {deactivateWarn} future reservations use this resource.
                  <button type="button" className="ml-2 underline" onClick={() => void deactivate(true)}>
                    Deactivate anyway
                  </button>
                </div>
              )}
              <button type="button" className="text-red-700" onClick={() => void deactivate()}>
                Deactivate resource
              </button>
            </div>
          )}
        </div>
      </div>

      {assignOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-xs">
            <h3 className="font-semibold">Assign services</h3>
            <div className="mt-2 space-y-1">
              {d.services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    checked={assignDraft.has(s.id)}
                    onChange={() => {
                      setAssignDraft((prev) => {
                        const next = new Set(prev);
                        if (next.has(s.id)) next.delete(s.id);
                        else next.add(s.id);
                        return next;
                      });
                    }}
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="appt-pilot-primary-btn"
                onClick={() => void saveServices([...assignDraft])}
              >
                Save
              </button>
              <button type="button" className="text-[var(--accent)]" onClick={() => setAssignOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
