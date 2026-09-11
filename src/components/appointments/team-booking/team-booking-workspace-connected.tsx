"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Users } from "lucide-react";
import { useTeamBookingWorkspace } from "@/features/appointments/kimi/team-booking/use-team-booking-workspace";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "rules", label: "Team rules" },
  { id: "services", label: "Service assignments" },
  { id: "templates", label: "Team templates" },
  { id: "test", label: "Availability test" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function TeamBookingWorkspaceConnected() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = (searchParams.get("section") as SectionId) || "overview";
  const ws = useTeamBookingWorkspace();

  const setSection = useCallback(
    (id: SectionId) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("section", id);
      router.replace(`/appointments/team-booking?${q.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  if (ws.loading) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="mx-auto max-w-[1560px] animate-pulse space-y-3">
          <div className="h-10 w-56 rounded bg-[var(--surface)]" />
          <div className="h-10 rounded bg-[var(--surface)]" />
          <div className="h-80 rounded bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  if (!ws.data) {
    return (
      <div className={`${SHELL} flex min-h-full items-center justify-center bg-[var(--surface-muted)] p-8`}>
        <p className="text-sm text-[var(--text-primary)]">{ws.error || "Could not load team booking"}</p>
      </div>
    );
  }

  const d = ws.data;
  const teamServices = d.services.filter((s) => s.teamMode === "team_required");

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="ws-icon-tile mt-0.5"><Users className="h-4 w-4" /></span>
              <div>
                <h1 className="ws-event-title">Team Booking</h1>
                <p className="ws-event-subtitle">
                  Schedule appointments that require multiple staff members at the same time.
                </p>
              </div>
            </div>
            <button type="button" className="appt-pilot-secondary-btn text-xs" onClick={() => setSection("test")}>
              Test availability
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
            <span>Team services <strong className="text-[var(--text-primary)]">{d.overview.teamServices}</strong></span>
            <span>Active rules <strong className="text-[var(--text-primary)]">{d.overview.activeRules}</strong></span>
            <span>Staff participating <strong className="text-[var(--text-primary)]">{d.overview.staffParticipating}</strong></span>
            <span>Ready <strong className="text-[var(--accent)]">{d.overview.ready}</strong></span>
            <span>Needs setup <strong className="text-amber-700">{d.overview.needsSetup}</strong></span>
            <span>Upcoming <strong className="text-[var(--text-primary)]">{d.overview.upcomingTeamBookings}</strong></span>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {SECTIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                  section === tab.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)]"
                }`}
                onClick={() => setSection(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        {section === "overview" && (
          <div className="grid grid-cols-12 gap-3 p-4 lg:px-6">
            <div className="col-span-12 md:col-span-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
              <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Team-booking coverage</p>
              <p className="mt-1 text-2xl font-semibold">{d.overview.teamServices}</p>
              <p className="mt-1 text-[var(--text-secondary)]">Services requiring multiple staff</p>
              <button type="button" className="appt-pilot-text-btn mt-2" onClick={() => setSection("services")}>Manage</button>
            </div>
            <div className="col-span-12 md:col-span-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
              <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Availability health</p>
              <ul className="mt-2 space-y-1">
                {["Staff schedules", "External calendars", "Locations", "Resources", "Team slot engine"].map((l) => (
                  <li key={l} className="flex justify-between"><span>{l}</span><span className="text-[var(--accent)]">Ready ✓</span></li>
                ))}
              </ul>
            </div>
            <div className="col-span-12 md:col-span-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
              <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Setup issues</p>
              {d.overview.issues.length === 0 ? (
                <p className="mt-2 text-[var(--text-secondary)]">No issues detected.</p>
              ) : (
                <ul className="mt-2 space-y-1">{d.overview.issues.map((i) => <li key={i.id}>{i.message}</li>)}</ul>
              )}
            </div>
            <div className="col-span-12 md:col-span-7 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
              <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">Upcoming team bookings</p>
              {d.upcoming.length === 0 ? (
                <p className="mt-2 text-[var(--text-secondary)]">No upcoming team bookings.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {d.upcoming.slice(0, 8).map((row) => (
                    <li key={row.id} className="flex justify-between gap-2 py-2">
                      <span>{new Date(row.at).toLocaleString()} · {row.serviceName} · {row.customer}</span>
                      <span className="font-medium">{row.teamLabel}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="col-span-12 md:col-span-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
              <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)]">How assignment works</p>
              <p className="mt-2 text-[var(--text-secondary)]">
                Required roles must all be available at the same time. The engine searches valid distinct-staff
                combinations (not greedy per-role assignment), then applies routing load scoring among valid teams.
              </p>
              <button type="button" className="appt-pilot-text-btn mt-2" onClick={() => setSection("rules")}>Edit default</button>
            </div>
          </div>
        )}

        {section === "rules" && (
          <div className="space-y-3 p-4 text-xs lg:px-6">
            <p className="text-[var(--text-secondary)]">
              Configure team requirements per Service (People &amp; place → Collective / Team) or enable structured
              requirements via Service editor. Reuse Staff Pools from{" "}
              <Link href="/appointments/routing?section=pools" className="text-[var(--accent)]">Routing</Link>.
            </p>
            {teamServices.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center">
                <Users className="mx-auto h-8 w-8 opacity-40" />
                <p className="mt-2">No team bookings configured</p>
                <Link href="/appointments/services" className="appt-pilot-primary-btn mt-3 inline-block">Configure a Service</Link>
              </div>
            ) : (
              teamServices.map((svc) => (
                <div key={svc.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{svc.name}</span>
                    <Link href={`/appointments/services?type=${svc.id}`} className="appt-pilot-text-btn">Edit team</Link>
                  </div>
                  <p className="mt-1 text-[var(--text-secondary)]">{svc.teamRuleLabel}</p>
                  <p className="mt-1">{svc.requiredStaff} required participants</p>
                </div>
              ))
            )}
          </div>
        )}

        {section === "services" && (
          <div className="overflow-x-auto p-4 lg:px-6">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                <tr>
                  <th className="py-2 pr-3">Service</th>
                  <th className="py-2 pr-3">Team mode</th>
                  <th className="py-2 pr-3">Required staff</th>
                  <th className="py-2 pr-3">Team rule</th>
                  <th className="py-2 pr-3">Locations</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.services.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-3 font-medium">
                      <Link href={`/appointments/services?type=${row.id}`} className="hover:text-[var(--accent)]">{row.name}</Link>
                    </td>
                    <td className="py-2 pr-3">{row.teamMode === "team_required" ? "Team required" : "Single staff"}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.requiredStaff}</td>
                    <td className="py-2 pr-3">{row.teamRuleLabel}</td>
                    <td className="py-2 pr-3 tabular-nums">{row.locationCount}</td>
                    <td className="py-2 pr-3">
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5">
                        {row.status === "ready" ? "Ready" : row.status === "needs_setup" ? "Needs setup" : "Not team-enabled"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section === "templates" && (
          <div className="p-4 text-xs lg:px-6">
            {d.templates.length === 0 ? (
              <p className="text-[var(--text-secondary)]">No reusable team templates yet. Define requirements on Services or add templates to platform config.</p>
            ) : (
              <table className="w-full text-xs">
                <thead><tr><th className="py-2 text-left">Template</th><th>Requirements</th><th>Status</th></tr></thead>
                <tbody>
                  {d.templates.map((t) => (
                    <tr key={t.id} className="border-t border-[var(--border)]">
                      <td className="py-2">{t.name}</td>
                      <td>{t.requirements.length}</td>
                      <td>{t.active !== false ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {section === "test" && (
          <TeamAvailabilityTest data={d} simulating={ws.simulating} result={ws.simResult} onRun={ws.runSimulate} />
        )}

        {section === "activity" && (
          <div className="overflow-x-auto p-4 lg:px-6">
            {!d.activity.length ? (
              <p className="text-sm text-[var(--text-secondary)]">Team-assignment activity will appear after team bookings are created.</p>
            ) : (
              <table className="w-full min-w-[800px] text-xs">
                <thead className="border-b border-[var(--border)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Booking</th>
                    <th className="py-2 pr-3">Service</th>
                    <th className="py-2 pr-3">Team</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {d.activity.map((row) => row && (
                    <tr key={row.id} className="border-b border-[var(--border)]">
                      <td className="py-2 pr-3">{new Date(row.at).toLocaleString()}</td>
                      <td className="py-2 pr-3">{row.bookingLabel}</td>
                      <td className="py-2 pr-3">{row.serviceName}</td>
                      <td className="py-2 pr-3 font-medium">{row.teamLabel}</td>
                      <td className="py-2 pr-3">{row.source}</td>
                      <td className="py-2 pr-3">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {section === "settings" && (
          <div className="space-y-3 p-4 text-xs lg:px-6">
            <p className="text-[var(--text-secondary)]">
              Team landing pages for multi-type booking remain at{" "}
              <Link href="/appointments/team-pages" className="text-[var(--accent)]">Team pages</Link> (separate from multi-staff Service team booking).
            </p>
            <p>Reschedule: preserve team when possible; replace individual roles when configured (runtime partial).</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TeamAvailabilityTest({
  data,
  simulating,
  result,
  onRun,
}: {
  data: NonNullable<ReturnType<typeof useTeamBookingWorkspace>["data"]>;
  simulating: boolean;
  result: unknown;
  onRun: (b: Record<string, unknown>) => void;
}) {
  const teamServices = data.services.filter((s) => s.teamMode === "team_required");
  const [serviceName, setServiceName] = useState(teamServices[0]?.name || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [locationId, setLocationId] = useState("");

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-12 lg:px-6">
      <div className="col-span-12 lg:col-span-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
        <label className="block">Service
          <select className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={serviceName} onChange={(e) => setServiceName(e.target.value)}>
            {teamServices.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </label>
        <label className="mt-2 block">Date
          <input type="date" className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="mt-2 block">Location
          <select className="mt-1 w-full rounded border border-[var(--border)] px-2 py-1.5" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Any</option>
            {data.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <button type="button" className="appt-pilot-primary-btn mt-3" disabled={simulating || !serviceName} onClick={() => onRun({ serviceName, date, locationId: locationId || undefined })}>
          {simulating ? "Running…" : "Run test"}
        </button>
      </div>
      <div className="col-span-12 lg:col-span-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs">
        {!result ? (
          <p className="text-[var(--text-secondary)]">Uses the same team combination engine as slot generation.</p>
        ) : (
          <SimResultView result={result as { slots: Array<{ startsAt: string; available: boolean; selectedTeam?: string; reason?: string }> }} />
        )}
      </div>
    </div>
  );
}

function SimResultView({ result }: { result: { slots: Array<{ startsAt: string; available: boolean; selectedTeam?: string; reason?: string }> } }) {
  return (
    <table className="w-full">
      <thead><tr className="text-[var(--text-secondary)]"><th className="py-1 text-left">Time</th><th>Status</th><th>Team</th></tr></thead>
      <tbody>
        {result.slots.map((s) => (
          <tr key={s.startsAt} className="border-t border-[var(--border)]">
            <td className="py-1.5">{new Date(s.startsAt).toLocaleTimeString()}</td>
            <td>{s.available ? <span className="text-[var(--accent)]">Available</span> : "No valid team"}</td>
            <td>{s.selectedTeam || s.reason || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
