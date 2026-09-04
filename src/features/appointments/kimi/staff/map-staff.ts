import { DAY_LABELS } from "@/features/appointments/kimi/availability/map-availability";
import type { BookableStaffMember } from "@/lib/appointments/types";
import type { StaffDayRow, StaffListItem } from "./types";

export function mapStaffToListItem(member: BookableStaffMember): StaffListItem {
  return {
    id: member.id,
    name: member.name || "Unnamed",
    active: member.active !== false,
    customerSelectable: member.customerSelectable !== false,
    typeCount: member.appointmentTypeIds?.length || 0,
    locationCount: member.locationIds?.length || 0,
  };
}

export function filterStaffList(items: StaffListItem[], query: string): StaffListItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((s) => s.name.toLowerCase().includes(q));
}

export function buildStaffDayRows(member: BookableStaffMember | null): StaffDayRow[] {
  return DAY_LABELS.map(({ key, label }) => {
    const windows = member?.weeklyHours?.[key] || [];
    return {
      key,
      label,
      usesWorkspaceDefault: windows.length === 0,
      windows: windows.length ? windows.map((w) => ({ open: w.open, close: w.close })) : [],
    };
  });
}
