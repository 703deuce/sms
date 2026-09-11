"use client";

import { useCallback, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useAvailabilityWorkspace } from "@/features/appointments/kimi/availability/use-availability-workspace";
import { AvailabilityHeader } from "./availability-header";
import { AvailabilityLocalNav } from "./availability-local-nav";
import { AvailabilityOverviewSection } from "./availability-overview-section";
import { AvailabilityWeeklyHoursSection } from "./availability-weekly-hours-section";
import { AvailabilityStaffSection } from "./availability-staff-section";
import { AvailabilityServicesSection } from "./availability-services-section";
import { AvailabilityLocationsSection } from "./availability-locations-section";
import { AvailabilityOverridesSection } from "./availability-overrides-section";
import { AvailabilityBookingRulesSection } from "./availability-booking-rules-section";
import { AvailabilityCalendarsSection } from "./availability-calendars-section";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";
import "@/components/appointments/kimi-ui/appointment-types/reference.css";

const SHELL_CLASS =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

function AvailabilityLoading() {
  return (
    <div className={`${SHELL_CLASS} min-h-full bg-[var(--surface-muted)] p-8`}>
      <div className="mx-auto max-w-[1560px] animate-pulse space-y-4">
        <div className="h-10 w-64 rounded bg-[var(--surface)]" />
        <div className="h-12 rounded bg-[var(--surface)]" />
        <div className="h-96 rounded bg-[var(--surface)]" />
      </div>
    </div>
  );
}

function AvailabilityError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={`${SHELL_CLASS} flex min-h-full items-center justify-center bg-[var(--surface-muted)] p-8`}>
      <div className="max-w-md rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--accent)]">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="font-semibold text-[var(--text-primary)]">We couldn&apos;t load availability</h3>
        <p className="mt-1.5 text-[var(--type-helper)] text-[var(--text-secondary)]">
          Something went wrong while fetching schedules and assignments.
        </p>
        <button type="button" className="appt-pilot-primary-btn mt-5" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}

export function AvailabilityWorkspaceConnected() {
  const ws = useAvailabilityWorkspace();

  const serviceOptions = useMemo(
    () => ws.types.map((t) => ({ id: t.id, name: t.name })),
    [ws.types],
  );
  const staffOptions = useMemo(
    () => ws.staff.filter((s) => s.active !== false).map((s) => ({ id: s.id, name: s.name })),
    [ws.staff],
  );

  const staffCountByLocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const location of ws.locations) {
      const count = ws.staff.filter((s) => (s.locationIds || []).includes(location.id)).length;
      map.set(location.id, count);
    }
    return map;
  }, [ws.locations, ws.staff]);

  const serviceCountByLocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const location of ws.locations) {
      const count = ws.types.filter((t) => (t.config?.locationIds || []).includes(location.id)).length;
      map.set(location.id, count);
    }
    return map;
  }, [ws.locations, ws.types]);

  const calendarStaffRows = useMemo(
    () =>
      ws.staffRows
        .filter((r) => r.member.calendarConnectionId)
        .map((r) => ({
          staffId: r.id,
          staffName: r.name,
          connectionLabel: r.calendarLabel,
          connected: r.calendarConnected,
        })),
    [ws.staffRows],
  );

  const handleStaffUseBusinessHours = useCallback(
    (staffId: string) => {
      void ws.updateStaffMember(staffId, { weeklyHours: {} });
    },
    [ws],
  );

  const handleStaffToggleDay = useCallback(
    (staffId: string, day: string, open: boolean) => {
      const member = ws.staff.find((s) => s.id === staffId);
      if (!member) return;
      const hours = { ...(member.weeklyHours || {}) };
      hours[day] = open ? [{ open: "09:00", close: "17:00" }] : [];
      void ws.updateStaffMember(staffId, { weeklyHours: hours });
    },
    [ws],
  );

  const handleStaffUpdateWindow = useCallback(
    (staffId: string, day: string, index: number, field: "open" | "close", value: string) => {
      const member = ws.staff.find((s) => s.id === staffId);
      if (!member) return;
      const hours = { ...(member.weeklyHours || {}) };
      const next = [...(hours[day] || [])];
      next[index] = { ...next[index], [field]: value };
      hours[day] = next;
      void ws.updateStaffMember(staffId, { weeklyHours: hours });
    },
    [ws],
  );

  const handleStaffAddWindow = useCallback(
    (staffId: string, day: string) => {
      const member = ws.staff.find((s) => s.id === staffId);
      if (!member) return;
      const hours = { ...(member.weeklyHours || {}) };
      hours[day] = [...(hours[day] || []), { open: "09:00", close: "12:00" }];
      void ws.updateStaffMember(staffId, { weeklyHours: hours });
    },
    [ws],
  );

  const handleStaffRemoveWindow = useCallback(
    (staffId: string, day: string, index: number) => {
      const member = ws.staff.find((s) => s.id === staffId);
      if (!member) return;
      const hours = { ...(member.weeklyHours || {}) };
      hours[day] = (hours[day] || []).filter((_, i) => i !== index);
      void ws.updateStaffMember(staffId, { weeklyHours: hours });
    },
    [ws],
  );

  if (ws.loading) return <AvailabilityLoading />;
  if (ws.failed) return <AvailabilityError onRetry={ws.load} />;

  return (
    <div className={`${SHELL_CLASS} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto flex w-full max-w-[1560px] flex-col">
        <AvailabilityHeader
          saving={ws.saving}
          saved={ws.saved}
          error={ws.error}
          onSave={() => void ws.saveSettings()}
          onPreview={() => ws.setSection("overview")}
        />
        <AvailabilityLocalNav active={ws.section} onChange={ws.setSection} attention={ws.attention} />
        <div className="px-4 py-4 lg:px-6">
          {ws.section === "overview" ? (
            <AvailabilityOverviewSection
              form={ws.form}
              stats={ws.stats}
              overviewOverrides={ws.overviewOverrides}
              services={serviceOptions}
              staff={staffOptions}
              locations={ws.locations}
              onNavigate={ws.setSection}
            />
          ) : null}

          {ws.section === "weekly-hours" ? (
            <AvailabilityWeeklyHoursSection
              form={ws.form}
              onToggleDay={ws.toggleDayOpen}
              onUpdateWindow={ws.updateWindow}
              onAddWindow={ws.addWindow}
              onRemoveWindow={ws.removeWindow}
              onCopyMondayToWeekdays={ws.copyMondayToWeekdays}
              onTimezoneChange={(value) => ws.patchForm({ timezone: value })}
            />
          ) : null}

          {ws.section === "staff" ? (
            <AvailabilityStaffSection
              rows={ws.staffRows}
              form={ws.form}
              services={serviceOptions}
              locations={ws.locations}
              onUseBusinessHours={handleStaffUseBusinessHours}
              onToggleService={ws.toggleStaffService}
              onToggleLocation={ws.toggleStaffLocation}
              onToggleDay={handleStaffToggleDay}
              onUpdateWindow={handleStaffUpdateWindow}
              onAddWindow={handleStaffAddWindow}
              onRemoveWindow={handleStaffRemoveWindow}
            />
          ) : null}

          {ws.section === "services" ? (
            <AvailabilityServicesSection rows={ws.serviceRows} />
          ) : null}

          {ws.section === "locations" ? (
            <AvailabilityLocationsSection
              form={ws.form}
              locations={ws.locations}
              resources={ws.resources}
              staffCountByLocation={staffCountByLocation}
              serviceCountByLocation={serviceCountByLocation}
            />
          ) : null}

          {ws.section === "overrides" ? (
            <AvailabilityOverridesSection
              form={ws.form}
              onPatch={ws.patchForm}
              onAddOverride={ws.addOverride}
              onRemoveOverride={ws.removeOverride}
            />
          ) : null}

          {ws.section === "booking-rules" ? (
            <AvailabilityBookingRulesSection
              form={ws.form}
              onPatch={ws.patchForm}
              onSave={() => void ws.saveSettings()}
              saving={ws.saving}
              saved={ws.saved}
            />
          ) : null}

          {ws.section === "calendars" ? (
            <AvailabilityCalendarsSection
              staffRows={calendarStaffRows}
              connections={ws.connections}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
