export type Slot = { startsAt: string; endsAt: string };

export type AppointmentPreview = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  status: string;
  timezone?: string | null;
  meetingLink?: string | null;
  isTransovoVideo?: boolean;
  locationLabel?: string | null;
  businessName?: string | null;
};

/**
 * Build an ISO string at a specific wall-clock time in the appointment's
 * timezone (America/New_York is UTC-4 during daylight saving). Using an
 * explicit offset keeps rendered times correct regardless of the sandbox
 * machine's local timezone.
 */
function at(dayOffset: number, hour: number, minute = 0) {
  const now = new Date();
  const target = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset, hour + 4, minute),
  );
  return target.toISOString();
}

export const MOCK_APPOINTMENT: AppointmentPreview = {
  id: "appt_8f2k1",
  serviceName: "Water Heater Estimate",
  startsAt: at(4, 10, 0),
  status: "scheduled",
  timezone: "America/New_York",
  meetingLink: null,
  isTransovoVideo: false,
  locationLabel: "Bright Home Services — Richmond Office",
  businessName: "Bright Home Services",
};

export const MOCK_SLOTS: Slot[] = [
  { startsAt: at(5, 9, 0), endsAt: at(5, 9, 30) },
  { startsAt: at(5, 10, 0), endsAt: at(5, 10, 30) },
  { startsAt: at(5, 13, 0), endsAt: at(5, 13, 30) },
  { startsAt: at(5, 15, 30), endsAt: at(5, 16, 0) },
  { startsAt: at(6, 9, 30), endsAt: at(6, 10, 0) },
  { startsAt: at(6, 11, 0), endsAt: at(6, 11, 30) },
  { startsAt: at(6, 14, 0), endsAt: at(6, 14, 30) },
  { startsAt: at(7, 10, 0), endsAt: at(7, 10, 30) },
  { startsAt: at(7, 13, 30), endsAt: at(7, 14, 0) },
  { startsAt: at(7, 16, 0), endsAt: at(7, 16, 30) },
  { startsAt: at(8, 9, 0), endsAt: at(8, 9, 30) },
  { startsAt: at(8, 11, 30), endsAt: at(8, 12, 0) },
];

export const MOCK_INVALID_LINK_ERROR =
  "This reschedule link is invalid or has expired. Contact the business to request a new link.";

export const MOCK_SUBMIT_ERROR =
  "That time was just booked by someone else. Please pick another available time.";
