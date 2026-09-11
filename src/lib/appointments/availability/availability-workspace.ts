import type { AppointmentTypeConfig, BookableStaffMember } from "@/lib/appointments/types";
import { DAY_LABELS, defaultWeeklyHours } from "@/features/appointments/kimi/availability/map-availability";
import type { AvailabilityFormState, TimeWindow } from "@/features/appointments/kimi/availability/types";

export type AvailabilitySource = "business_default" | "named_schedule" | "custom_hours";

export type StaffAvailabilityRow = {
  id: string;
  name: string;
  initials: string;
  source: AvailabilitySource;
  sourceLabel: string;
  scheduleSummary: string;
  serviceCount: number;
  locationCount: number;
  calendarLabel: string;
  calendarConnected: boolean;
  status: "ready" | "no_schedule" | "no_services" | "no_location" | "calendar_disconnected" | "setup_issue";
  statusLabel: string;
  member: BookableStaffMember;
};

export type ServiceAvailabilityRow = {
  id: string;
  name: string;
  durationMinutes: number;
  eligibleStaffCount: number;
  locationCount: number;
  availabilityLabel: string;
  timingRules: string;
  status: "ready" | "no_staff" | "no_location" | "setup_issue";
  statusLabel: string;
  config: AppointmentTypeConfig;
};

export function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatWindowRange(windows: TimeWindow[]): string {
  if (!windows.length) return "Closed";
  return windows.map((w) => `${formatTime12h(w.open)} – ${formatTime12h(w.close)}`).join(", ");
}

export function summarizeWeeklyHours(weeklyHours: Record<string, TimeWindow[]>): string {
  const openDays = DAY_LABELS.filter(({ key }) => (weeklyHours[key] || []).length > 0);
  if (!openDays.length) return "No hours configured";
  const first = openDays[0];
  const windows = weeklyHours[first.key] || [];
  const range = formatWindowRange(windows);
  if (openDays.length === 5 && openDays.every((d, i) => DAY_LABELS[i].key === d.key)) {
    return `Mon–Fri · ${range}`;
  }
  if (openDays.length === 7) return `Every day · ${range}`;
  const labels = openDays.map((d) => d.label.slice(0, 3)).join(", ");
  return `${labels} · ${range}`;
}

export function staffInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function resolveStaffAvailabilitySource(
  staff: BookableStaffMember,
  form: AvailabilityFormState,
): { source: AvailabilitySource; label: string } {
  if (staff.weeklyHours && Object.values(staff.weeklyHours).some((w) => w.length > 0)) {
    return { source: "custom_hours", label: "Custom schedule" };
  }
  if (form.namedSchedules.length > 0) {
    const named = form.namedSchedules.find((s) => s.isDefault) || form.namedSchedules[0];
    return { source: "named_schedule", label: named ? named.name : "Shared schedule" };
  }
  return { source: "business_default", label: "Business default" };
}

export function staffHasSchedule(staff: BookableStaffMember, form: AvailabilityFormState): boolean {
  if (staff.weeklyHours && Object.values(staff.weeklyHours).some((w) => w.length > 0)) return true;
  const businessOpen = Object.values(form.weeklyHours).some((w) => w.length > 0);
  return businessOpen || form.namedSchedules.length > 0;
}

export function buildStaffRows(
  staff: BookableStaffMember[],
  form: AvailabilityFormState,
  calendarByStaffId: Map<string, { label: string; connected: boolean }>,
): StaffAvailabilityRow[] {
  return staff
    .filter((s) => s.active !== false)
    .map((member) => {
      const { source, label: sourceLabel } = resolveStaffAvailabilitySource(member, form);
      const weekly =
        member.weeklyHours && Object.keys(member.weeklyHours).length
          ? member.weeklyHours
          : form.weeklyHours;
      const scheduleSummary = summarizeWeeklyHours(weekly);
      const serviceCount = member.appointmentTypeIds?.length ?? 0;
      const locationCount = member.locationIds?.length ?? 0;
      const calendar = calendarByStaffId.get(member.calendarConnectionId || "") || {
        label: "Not connected",
        connected: false,
      };

      let status: StaffAvailabilityRow["status"] = "ready";
      let statusLabel = "Ready";
      if (!staffHasSchedule(member, form)) {
        status = "no_schedule";
        statusLabel = "No schedule";
      } else if (serviceCount === 0) {
        status = "no_services";
        statusLabel = "No services assigned";
      } else if (locationCount === 0) {
        status = "no_location";
        statusLabel = "No location";
      } else if (member.calendarConnectionId && !calendar.connected) {
        status = "calendar_disconnected";
        statusLabel = "Calendar disconnected";
      }

      return {
        id: member.id,
        name: member.name,
        initials: staffInitials(member.name),
        source,
        sourceLabel,
        scheduleSummary,
        serviceCount,
        locationCount,
        calendarLabel: calendar.label,
        calendarConnected: calendar.connected,
        status,
        statusLabel,
        member,
      };
    });
}

export function countEligibleStaffForType(
  typeId: string,
  staff: BookableStaffMember[],
  config: AppointmentTypeConfig,
): number {
  const staffIds = config.staffIds || [];
  const fromType = staffIds.length
    ? staff.filter((s) => staffIds.includes(s.id) && s.active !== false)
    : staff.filter(
        (s) => s.active !== false && (s.appointmentTypeIds || []).includes(typeId),
      );
  return fromType.length;
}

export function buildServiceTimingRules(config: AppointmentTypeConfig): string {
  const parts: string[] = [];
  const before = config.bufferBeforeMinutes ?? 0;
  const after = config.bufferAfterMinutes ?? 0;
  if (before || after) parts.push(`${before}/${after} min buffer`);
  const fixed = config.schedulingLimits?.fixedStartTimes;
  if (fixed?.enabled && fixed.times?.length) {
    parts.push(`${fixed.times.length} fixed starts`);
  } else if (config.schedulingLimits?.customStartIntervalMinutes) {
    parts.push(`Every ${config.schedulingLimits.customStartIntervalMinutes} min`);
  }
  return parts.length ? parts.join(" · ") : "Staff schedules";
}

export function buildServiceRows(
  types: Array<{
    id: string;
    name: string;
    durationMinutes?: number;
    config?: AppointmentTypeConfig | null;
  }>,
  staff: BookableStaffMember[],
  locations: Array<{ id: string; name: string }>,
): ServiceAvailabilityRow[] {
  return types.map((type) => {
    const config = (type.config || {}) as AppointmentTypeConfig;
    const eligibleStaffCount = countEligibleStaffForType(type.id, staff, config);
    const locationIds = config.locationIds || [];
    const locationCount = locationIds.length || locations.length;
    let status: ServiceAvailabilityRow["status"] = "ready";
    let statusLabel = "Ready";
    if (eligibleStaffCount === 0) {
      status = "no_staff";
      statusLabel = "No eligible staff";
    } else if (locationIds.length === 0 && locations.length > 0) {
      status = "no_location";
      statusLabel = "No locations set";
    }
    return {
      id: type.id,
      name: type.name,
      durationMinutes: type.durationMinutes ?? 30,
      eligibleStaffCount,
      locationCount,
      availabilityLabel: config.namedScheduleId ? "Named schedule" : "Staff schedules",
      timingRules: buildServiceTimingRules(config),
      status,
      statusLabel,
      config,
    };
  });
}

export function businessHoursOpenDays(form: AvailabilityFormState): number {
  return DAY_LABELS.filter(({ key }) => (form.weeklyHours[key] || []).length > 0).length;
}

export function upcomingOverrides(form: AvailabilityFormState, limit = 3) {
  const today = new Date().toISOString().slice(0, 10);
  return form.dateOverrides
    .filter((o) => o.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
    .map((o) => ({
      date: o.date,
      label: o.closed ? "Unavailable" : "Custom hours",
      hours: o.closed ? "All day" : formatWindowRange(o.windows || []),
    }));
}

export function emptyWeeklyHours(): Record<string, TimeWindow[]> {
  return defaultWeeklyHours();
}
