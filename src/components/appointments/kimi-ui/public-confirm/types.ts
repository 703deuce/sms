export type ActionKind = "confirm" | "cancel" | "reschedule";

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
  staffName?: string | null;
  durationMinutes?: number | null;
};

export type Slot = { startsAt: string; endsAt: string };

function isoOffset(days: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export const MOCK_APPOINTMENT: AppointmentPreview = {
  id: "appt_9f2k41",
  serviceName: "Initial Consultation",
  startsAt: isoOffset(3, 14, 0),
  status: "awaiting_confirmation",
  timezone: "America/New_York",
  meetingLink: "https://meet.transovo.com/r/initial-consult-9f2k41",
  isTransovoVideo: true,
  locationLabel: "Transovo Video",
  businessName: "Brightline Consulting",
  staffName: "Sarah Mitchell",
  durationMinutes: 30,
};

export const MOCK_SLOTS: Slot[] = [
  { startsAt: isoOffset(4, 9, 0), endsAt: isoOffset(4, 9, 30) },
  { startsAt: isoOffset(4, 10, 30), endsAt: isoOffset(4, 11, 0) },
  { startsAt: isoOffset(4, 13, 0), endsAt: isoOffset(4, 13, 30) },
  { startsAt: isoOffset(5, 9, 30), endsAt: isoOffset(5, 10, 0) },
  { startsAt: isoOffset(5, 11, 0), endsAt: isoOffset(5, 11, 30) },
  { startsAt: isoOffset(5, 15, 30), endsAt: isoOffset(5, 16, 0) },
  { startsAt: isoOffset(6, 10, 0), endsAt: isoOffset(6, 10, 30) },
  { startsAt: isoOffset(6, 14, 30), endsAt: isoOffset(6, 15, 0) },
];

export const ACTION_COPY: Record<
  ActionKind,
  { heading: string; subtext: string; done: string; doneSubtext: string; cta: string }
> = {
  confirm: {
    heading: "Confirm your appointment",
    subtext: "Let us know you're still planning to attend.",
    done: "Your appointment is confirmed",
    doneSubtext: "See you then! We'll send you a reminder before your appointment.",
    cta: "Confirm appointment",
  },
  cancel: {
    heading: "Cancel your appointment",
    subtext: "This will free up your time slot and stop any upcoming reminders.",
    done: "Your appointment has been canceled",
    doneSubtext: "Any scheduled reminders for this appointment have been stopped.",
    cta: "Cancel appointment",
  },
  reschedule: {
    heading: "Reschedule your appointment",
    subtext: "Choose a new time that works for you. Your reminders will update automatically.",
    done: "Your appointment has been rescheduled",
    doneSubtext: "Check your texts for the updated details.",
    cta: "Confirm new time",
  },
};
