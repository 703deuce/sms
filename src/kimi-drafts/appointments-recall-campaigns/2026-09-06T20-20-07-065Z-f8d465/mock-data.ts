export type RecallCampaign = {
  id: string;
  name: string;
  active: boolean;
  channel: "sms" | "email";
  subject?: string;
  messageTemplate: string;
  segment?: {
    lastVisitDaysAgo?: number;
    appointmentTypeId?: string;
    appointmentTypeName?: string;
    noFutureAppointment?: boolean;
  };
  maxRecipients?: number;
  lastRunAt?: string;
  lastRunSent?: number;
  createdAt: string;
};

export const mockCampaigns: RecallCampaign[] = [
  {
    id: "rc_1",
    name: "90-day win-back",
    active: true,
    channel: "sms",
    messageTemplate:
      "Hi {{first_name}}, it's been a while since your last visit to {{business_name}}. We'd love to see you again — book your next appointment here: {{booking_link}}",
    segment: { lastVisitDaysAgo: 90, noFutureAppointment: true },
    maxRecipients: 250,
    lastRunAt: "2026-09-01T14:22:00Z",
    lastRunSent: 148,
    createdAt: "2026-06-12T10:00:00Z",
  },
  {
    id: "rc_2",
    name: "Annual checkup reminder",
    active: true,
    channel: "email",
    subject: "Time for your annual checkup, {{first_name}}",
    messageTemplate:
      "Hi {{first_name}},\n\nIt's been about a year since your last Annual Checkup at {{business_name}}. Staying on schedule helps us catch small issues before they become big ones.\n\nBook your next visit: {{booking_link}}\n\nSee you soon,\n{{business_name}}",
    segment: {
      lastVisitDaysAgo: 365,
      appointmentTypeName: "Annual Checkup",
      noFutureAppointment: true,
    },
    maxRecipients: 500,
    lastRunAt: "2026-08-18T09:05:00Z",
    lastRunSent: 312,
    createdAt: "2026-05-02T15:30:00Z",
  },
  {
    id: "rc_3",
    name: "Consultation follow-up",
    active: false,
    channel: "sms",
    messageTemplate:
      "{{first_name}}, thanks for your consultation with {{business_name}}. Ready to schedule the next step? Reply YES or book here: {{booking_link}}",
    segment: {
      lastVisitDaysAgo: 30,
      appointmentTypeName: "Initial Consultation",
      noFutureAppointment: true,
    },
    lastRunAt: "2026-07-29T17:41:00Z",
    lastRunSent: 64,
    createdAt: "2026-07-01T11:15:00Z",
  },
  {
    id: "rc_4",
    name: "Lapsed clients — 6 months",
    active: false,
    channel: "email",
    subject: "We miss you at {{business_name}}",
    messageTemplate:
      "Hi {{first_name}},\n\nIt's been over six months since your last appointment. We'd love to welcome you back — your history and preferences are saved, so rebooking takes less than a minute.\n\n{{booking_link}}",
    segment: { lastVisitDaysAgo: 180, noFutureAppointment: false },
    createdAt: "2026-04-20T08:45:00Z",
  },
];

export const mergeTags = [
  { tag: "{{first_name}}", description: "Contact's first name" },
  { tag: "{{business_name}}", description: "Your business name" },
  { tag: "{{booking_link}}", description: "Link to your booking page" },
  { tag: "{{appointment_type}}", description: "Last booked service name" },
];
