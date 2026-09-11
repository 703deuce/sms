"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Users } from "lucide-react";
import { useStaffDetail } from "@/features/appointments/kimi/staff/use-staff-workspace";
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
  { id: "locations", label: "Locations" },
  { id: "scheduling", label: "Scheduling" },
  { id: "public", label: "Public profile" },
  { id: "appointments", label: "Appointments" },
  { id: "account", label: "Account & access" },
  { id: "advanced", label: "Advanced" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function StaffDetailConnected({ staffId }: { staffId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as SectionId) || "overview";
  const detail = useStaffDetail(staffId);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deactivateWarn, setDeactivateWarn] = useState<number | null>(null);

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/staff/${staffId}?${q.toString()}`, { scroll: false });
    },
    [router, searchParams, staffId],
  );

  const m = detail.data?.member;
  const displayName = m?.publicDisplayName || m?.name || "Staff";

  async function saveProfile() {
    if (!m) return;
    setSaving(true);
    setError("");
    try {
      await detail.patch({
        member: {
          name: draft.name ?? m.name,
          publicDisplayName: draft.publicDisplayName ?? m.publicDisplayName,
          title: draft.title ?? m.title,
          email: draft.email ?? m.email,
          phone: draft.phone ?? m.phone,
          bio: draft.bio ?? m.bio,
          avatarUrl: draft.avatarUrl ?? m.avatarUrl,
          customerSelectable:
            draft.customerSelectable !== undefined
              ? draft.customerSelectable === "true"
              : m.customerSelectable !== false,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleService(typeId: string, assigned: boolean) {
    if (!detail.data) return;
    const ids = detail.data.services.filter((s) => s.assigned).map((s) => s.id);
    const next = assigned ? ids.filter((id) => id !== typeId) : [...ids, typeId];
    await detail.patch({ appointmentTypeIds: next });
  }

  async function toggleLocation(locId: string, assigned: boolean) {
    if (!detail.data) return;
    const ids = detail.data.locations.filter((l) => l.assigned).map((l) => l.id);
    const next = assigned ? ids.filter((id) => id !== locId) : [...ids, locId];
    await detail.patch({ locationIds: next });
  }

  async function deactivate(force = false) {
    try {
      await detail.patch({ deactivate: true, forceDeactivate: force });
      setDeactivateWarn(null);
    } catch (e) {
      const err = e as Error & { code?: string; futureAppointmentCount?: number };
      if (err.code === "future_appointments") {
        setDeactivateWarn(err.futureAppointmentCount || 0);
      } else {
        setError(err.message);
      }
    }
  }

  if (detail.loading) {
    return <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}><div className="h-40 animate-pulse rounded bg-[var(--surface)]" /></div>;
  }

  if (!detail.data || !m) {
    return (
      <div className={`${SHELL} p-8 text-sm`}>
        {detail.error || "Staff not found"}{" "}
        <Link href="/appointments/staff" className="text-[var(--accent)]">Back</Link>
      </div>
    );
  }

  const d = detail.data;
  const initials = d.availability.initials;

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <Link href="/appointments/staff" className="text-xs text-[var(--accent)]">← Staff</Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {m.avatarUrl ? (
                <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">{initials}</span>
              )}
              <div>
                <h1 className="ws-event-title">{displayName}</h1>
                <p className="text-xs text-[var(--text-muted)]">{m.title || m.role || "Provider"}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="ws-chip">{m.active === false ? "Inactive" : "Active"}</span>
                  {m.customerSelectable !== false && <span className="ws-chip">Public</span>}
                  {d.scheduling.calendarConnected && <span className="ws-chip">Calendar connected</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={d.scheduling.availabilityHref} className="appt-pilot-secondary-btn text-xs">View schedule</Link>
              <button type="button" className="appt-pilot-primary-btn text-xs" disabled={saving} onClick={() => void saveProfile()}>
                Save changes
              </button>
            </div>
          </div>
          <nav className="mt-3 flex flex-wrap gap-1 border-t border-[var(--border)] pt-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`rounded-md px-2 py-1 text-xs ${section === s.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="p-4 lg:p-6 text-xs">
          {error && <p className="mb-3 text-red-600" role="alert">{error}</p>}

          {section === "overview" && (
            <div className="grid gap-3 lg:grid-cols-12">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-7">
                <div className="font-medium">Profile</div>
                <p className="mt-1">{m.name}</p>
                <p className="text-[var(--text-muted)]">{m.email}</p>
                <p className="mt-2 line-clamp-3">{m.bio || "No bio yet."}</p>
                <button type="button" className="mt-2 text-[var(--accent)]" onClick={() => setSection("public")}>Edit profile</button>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-5">
                <div className="font-medium">Setup health</div>
                <ul className="mt-2 space-y-1">
                  {d.setupIssues.length === 0 ? (
                    <li className="text-[var(--accent)]">Ready ✓</li>
                  ) : (
                    d.setupIssues.map((i) => (
                      <li key={i.id}><Link href={i.href} className="text-[var(--accent)]">{i.message}</Link></li>
                    ))
                  )}
                </ul>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <div className="font-medium">Booking summary</div>
                <p className="mt-1">Upcoming: {d.bookingStats.upcoming}</p>
                <p>Today: {d.bookingStats.today}</p>
                <p>Last 30 days: {d.bookingStats.last30Days}</p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <div className="font-medium">Services</div>
                <p className="mt-1">{d.services.filter((s) => s.assigned).length} assigned</p>
                <button type="button" className="text-[var(--accent)]" onClick={() => setSection("services")}>Manage</button>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-4">
                <div className="font-medium">Locations</div>
                <p className="mt-1">{d.locations.filter((l) => l.assigned).length} assigned</p>
                <button type="button" className="text-[var(--accent)]" onClick={() => setSection("locations")}>Manage</button>
              </div>
            </div>
          )}

          {section === "services" && (
            <table className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Service</th>
                  <th className="px-3 py-2">Assigned</th>
                  <th className="px-3 py-2">Routing</th>
                  <th className="px-3 py-2">Team booking</th>
                </tr>
              </thead>
              <tbody>
                {d.services.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{s.name}</td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={s.assigned} onChange={() => void toggleService(s.id, s.assigned)} aria-label={`Assign ${s.name}`} />
                    </td>
                    <td className="px-3 py-2 text-center">{s.routingLabel}</td>
                    <td className="px-3 py-2 text-center">{s.teamBooking ? "Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {section === "locations" && (
            <table className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Location</th>
                  <th className="px-3 py-2">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {d.locations.map((l) => (
                  <tr key={l.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{l.name}</td>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={l.assigned} onChange={() => void toggleLocation(l.id, l.assigned)} aria-label={`Assign ${l.name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {section === "scheduling" && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="font-medium">Availability source</div>
                <p className="mt-1">{d.scheduling.sourceLabel}</p>
                <Link href={d.scheduling.availabilityHref} className="mt-2 inline-flex items-center gap-1 text-[var(--accent)]">
                  Open full Availability <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                <div className="font-medium">Calendar</div>
                <p className="mt-1">{d.scheduling.calendarLabel} {d.scheduling.calendarConnected ? "✓" : ""}</p>
                <Link href={d.scheduling.calendarManageHref} className="mt-2 text-[var(--accent)]">Manage calendar</Link>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 lg:col-span-2">
                <div className="font-medium">Weekly summary</div>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {d.scheduling.weeklySummary.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {section === "public" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                {(["name", "publicDisplayName", "title", "bio", "avatarUrl", "email"] as const).map((field) => (
                  <label key={field} className="block">
                    <span className="ws-field-label">{field}</span>
                    <input
                      className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5"
                      value={draft[field] ?? String(m[field] || "")}
                      onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.customerSelectable !== "false" && m.customerSelectable !== false}
                    onChange={(e) => setDraft((d) => ({ ...d, customerSelectable: e.target.checked ? "true" : "false" }))}
                  />
                  Allow customer provider selection (when Service permits)
                </label>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="font-medium">Public preview</div>
                <div className="mt-3 flex items-start gap-3">
                  <Users className="h-8 w-8 text-[var(--accent)]" />
                  <div>
                    <div className="font-semibold">{draft.publicDisplayName || m.publicDisplayName || m.name}</div>
                    <div className="text-[var(--text-muted)]">{draft.title || m.title}</div>
                    <p className="mt-2 text-sm">{draft.bio || m.bio}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === "appointments" && (
            <table className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <tr>
                  <th className="px-3 py-2 text-left">Date/time</th>
                  <th className="px-3 py-2 text-left">Customer</th>
                  <th className="px-3 py-2 text-left">Offering</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.appointments.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2">{new Date(a.startsAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{a.customerName}</td>
                    <td className="px-3 py-2">{a.serviceName}</td>
                    <td className="px-3 py-2 text-center">{a.role}</td>
                    <td className="px-3 py-2 text-center">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {section === "account" && (
            <div className="max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="font-medium">Transovo access</div>
              <p className="mt-2 text-[var(--text-muted)]">
                Staff records can exist without a login. User invites and permissions are managed in Team settings.
              </p>
              <Link href="/settings/team" className="mt-3 inline-block text-[var(--accent)]">Manage team access</Link>
            </div>
          )}

          {section === "advanced" && (
            <div className="max-w-md space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
              <p>Staff ID: <code>{m.id}</code></p>
              <p>Routing: eligible on {d.routingSummary.eligibleServices} services — <Link href={d.routingSummary.href} className="text-[var(--accent)]">Open Routing</Link></p>
              <p>Team booking: {d.teamBookingSummary.serviceCount} services — <Link href={d.teamBookingSummary.href} className="text-[var(--accent)]">Open Team Booking</Link></p>
              {deactivateWarn !== null && (
                <div className="rounded border border-amber-200 bg-amber-50 p-2" role="alert">
                  {deactivateWarn} future appointments.{" "}
                  <button type="button" className="underline" onClick={() => void deactivate(true)}>Deactivate anyway</button>
                </div>
              )}
              <button type="button" className="text-red-600" onClick={() => void deactivate(false)}>Deactivate staff</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
