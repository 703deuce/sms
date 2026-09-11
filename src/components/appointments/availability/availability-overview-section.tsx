"use client";

import type { AvailabilitySectionId } from "./availability-section-types";
import { AvailabilitySlotPreview } from "./availability-slot-preview";
import { summarizeWeeklyHours } from "@/lib/appointments/availability/availability-workspace";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";

type Props = {
  form: AvailabilityFormState;
  stats: {
    openDays: number;
    staffTotal: number;
    staffScheduled: number;
    staffNeedsSetup: number;
    upcomingOverrideCount: number;
    servicesTotal: number;
    servicesWithStaff: number;
    locationsActive: number;
    resourcesCount: number;
    calendarsConnected: number;
  };
  overviewOverrides: Array<{ date: string; label: string; hours: string }>;
  services: Array<{ id: string; name: string }>;
  staff: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  onNavigate: (section: AvailabilitySectionId) => void;
};

export function AvailabilityOverviewSection({
  form,
  stats,
  overviewOverrides,
  services,
  staff,
  locations,
  onNavigate,
}: Props) {
  const scheduleSummary = summarizeWeeklyHours(form.weeklyHours);

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="ws-panel lg:col-span-4">
          <div className="ws-panel-head">
            <h2 className="ws-panel-title">Schedule coverage</h2>
          </div>
          <div className="px-4 py-3">
            <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">Business hours</p>
            <p className="ws-stat-note">{scheduleSummary}</p>
            <p className="mt-2 ws-stat-note">
              {form.namedSchedules.length} named schedule{form.namedSchedules.length === 1 ? "" : "s"}
            </p>
            <button type="button" className="ws-text-btn mt-3" onClick={() => onNavigate("weekly-hours")}>
              Edit weekly hours
            </button>
          </div>
        </div>

        <div className="ws-panel lg:col-span-4">
          <div className="ws-panel-head">
            <h2 className="ws-panel-title">Staff coverage</h2>
          </div>
          <div className="px-4 py-3">
            <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
              {stats.staffTotal} staff
            </p>
            <p className="ws-stat-note">{stats.staffScheduled} have availability</p>
            {stats.staffNeedsSetup > 0 ? (
              <p className="ws-stat-note text-[var(--state-warning)]">
                {stats.staffNeedsSetup} need setup
              </p>
            ) : null}
            <button type="button" className="ws-text-btn mt-3" onClick={() => onNavigate("staff")}>
              Review staff
            </button>
          </div>
        </div>

        <div className="ws-panel lg:col-span-4">
          <div className="ws-panel-head">
            <h2 className="ws-panel-title">Upcoming overrides</h2>
          </div>
          <div className="px-4 py-3">
            {overviewOverrides.length === 0 ? (
              <p className="ws-stat-note">No upcoming schedule changes.</p>
            ) : (
              <ul className="space-y-2">
                {overviewOverrides.map((row) => (
                  <li key={row.date} className="flex justify-between gap-2 text-[var(--type-list)]">
                    <span className="font-medium text-[var(--text-primary)]">{row.date}</span>
                    <span className="text-[var(--text-secondary)]">{row.label} · {row.hours}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="ws-text-btn mt-3" onClick={() => onNavigate("overrides")}>
              View overrides
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <AvailabilitySlotPreview
            services={services}
            staff={staff}
            locations={locations}
            compact
          />
        </div>
        <div className="ws-panel lg:col-span-4">
          <div className="ws-panel-head">
            <h2 className="ws-panel-title">Setup health</h2>
          </div>
          <ul className="divide-y divide-[var(--border)] px-4">
            {[
              { label: "Business hours", ok: stats.openDays > 0, detail: stats.openDays > 0 ? "Configured" : "Missing" },
              {
                label: "Staff schedules",
                ok: stats.staffNeedsSetup === 0,
                detail: `${stats.staffScheduled} / ${stats.staffTotal} configured`,
              },
              {
                label: "Service assignments",
                ok: stats.servicesWithStaff === stats.servicesTotal,
                detail: `${stats.servicesWithStaff} / ${stats.servicesTotal} complete`,
              },
              {
                label: "Calendar conflicts",
                ok: stats.calendarsConnected > 0,
                detail: stats.calendarsConnected > 0 ? "Connected" : "Not connected",
              },
              {
                label: "Resources",
                ok: true,
                detail: stats.resourcesCount > 0 ? `${stats.resourcesCount} constraints active` : "None configured",
              },
            ].map((row) => (
              <li key={row.label} className="flex items-center justify-between py-2.5 text-[var(--type-list)]">
                <span className="text-[var(--text-primary)]">{row.label}</span>
                <span className={row.ok ? "ws-badge is-success" : "ws-badge is-warning"}>{row.detail}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-[var(--border)] px-4 py-3">
            <button type="button" className="ws-text-btn" onClick={() => onNavigate("staff")}>
              Review issues
            </button>
          </div>
        </div>
      </div>

      <div className="ws-panel">
        <div className="ws-panel-head">
          <h2 className="ws-panel-title">Assignment summary</h2>
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {[
            { label: "Staff", value: `${stats.staffTotal} total · ${stats.staffScheduled} scheduled`, section: "staff" as const },
            { label: "Services", value: `${stats.servicesTotal} · ${stats.servicesWithStaff} with eligible staff`, section: "services" as const },
            { label: "Locations", value: `${stats.locationsActive} active`, section: "locations" as const },
            { label: "Resources", value: `${stats.resourcesCount} scheduling resources`, section: "locations" as const },
            { label: "Overrides", value: `${stats.upcomingOverrideCount} upcoming`, section: "overrides" as const },
            { label: "Calendars", value: `${stats.calendarsConnected} connected`, section: "calendars" as const },
          ].map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <div>
                <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">{row.label}</p>
                <p className="ws-stat-note">{row.value}</p>
              </div>
              <button type="button" className="ws-text-btn" onClick={() => onNavigate(row.section)}>
                Manage
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
