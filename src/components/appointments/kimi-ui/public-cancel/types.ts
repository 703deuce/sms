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
  businessPhone?: string | null;
  customerFirstName?: string | null;
};

// Tomorrow at 2:00 PM ET
const startsAt = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();

export const mockAppointment: AppointmentPreview = {
  id: "appt_8f3k2",
  serviceName: "Water Heater Estimate",
  startsAt,
  status: "confirmed",
  timezone: "America/New_York",
  meetingLink: null,
  isTransovoVideo: false,
  locationLabel: "Customer location — 1482 Maple St",
  businessName: "Hartley Plumbing Co.",
  businessPhone: "+15714073615",
  customerFirstName: "Sarah",
};

export const cancellationPolicy = {
  allowed: true,
  cutoffHours: 24,
  policyText:
    "You can cancel online up to 24 hours before your appointment. Inside that window, please call the business directly.",
};

export type PageState =
  | "loading"
  | "error"
  | "normal"
  | "blocked"
  | "already"
  | "success";
