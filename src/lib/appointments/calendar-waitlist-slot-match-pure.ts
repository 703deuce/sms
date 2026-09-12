export type CalendarOpenSlotInput = {
  workspaceId: string;
  startsAt: string;
  endsAt?: string;
  serviceName?: string;
  serviceId?: string;
  staffId?: string;
  locationId?: string;
};

function parseHm(isoOrHm: string): number | null {
  if (/^\d{1,2}:\d{2}$/.test(isoOrHm)) {
    const [h, m] = isoOrHm.split(":").map(Number);
    return h * 60 + m;
  }
  const d = new Date(isoOrHm);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function slotDayKey(startsAt: string) {
  return new Date(startsAt).toISOString().slice(0, 10);
}

export function entryMatchesWaitlistSlotPreferences(
  entry: {
    serviceName?: string | null;
    appointmentTypeId?: string | null;
    locationId?: string | null;
    staffPreference?: string | null;
    preferredDate?: string | null;
    preferredTimeStart?: string | null;
    preferredTimeEnd?: string | null;
  },
  slot: CalendarOpenSlotInput,
): boolean {
  if (entry.serviceName && slot.serviceName && entry.serviceName !== slot.serviceName) {
    return false;
  }
  if (entry.appointmentTypeId && slot.serviceId && entry.appointmentTypeId !== slot.serviceId) {
    return false;
  }
  if (entry.locationId && slot.locationId && entry.locationId !== slot.locationId) {
    return false;
  }
  if (entry.staffPreference && slot.staffId && entry.staffPreference !== slot.staffId) {
    return false;
  }
  if (entry.preferredDate) {
    const slotDay = slotDayKey(slot.startsAt);
    if (entry.preferredDate !== slotDay) return false;
  }
  const slotMinutes = parseHm(slot.startsAt);
  if (slotMinutes != null) {
    const startPref = entry.preferredTimeStart ? parseHm(entry.preferredTimeStart) : null;
    const endPref = entry.preferredTimeEnd ? parseHm(entry.preferredTimeEnd) : null;
    if (startPref != null && slotMinutes < startPref) return false;
    if (endPref != null && slotMinutes > endPref) return false;
  }
  return true;
}
