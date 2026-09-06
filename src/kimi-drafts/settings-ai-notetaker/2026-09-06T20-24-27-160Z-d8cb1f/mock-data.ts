export type NotetakerJoinRule =
  | "all_supported"
  | "transovo_only"
  | "connected_calendar"
  | "external_participants"
  | "selected_types"
  | "manual_only";

export type SummaryTemplateId =
  | "general"
  | "sales"
  | "consultation"
  | "customer_success"
  | "interview"
  | "project_status"
  | "one_on_one"
  | "custom";

export type NotetakerPlatformConfig = {
  enabled: boolean;
  joinRule: NotetakerJoinRule;
  selectedEventTypeIds: string[];
  externalParticipantsOnly: boolean;
  recordingEnabled: boolean;
  transcriptEnabled: boolean;
  summaryEnabled: boolean;
  actionItemsEnabled: boolean;
  followUpEnabled: boolean;
  botName: string;
  summaryTemplate: SummaryTemplateId;
  notifyAttendeesAdvance: boolean;
  advanceNoticeText: string;
  emailOnRecapReady: boolean;
  autoShareWith: "nobody" | "organizer" | "internal" | "all_attendees";
  recordingRetentionDays: number;
  transcriptRetentionDays: number;
};

export const initialConfig: NotetakerPlatformConfig = {
  enabled: true,
  joinRule: "transovo_only",
  selectedEventTypeIds: ["initial-consultation", "follow-up"],
  externalParticipantsOnly: false,
  recordingEnabled: true,
  transcriptEnabled: true,
  summaryEnabled: true,
  actionItemsEnabled: true,
  followUpEnabled: true,
  botName: "Transovo Notetaker",
  summaryTemplate: "general",
  notifyAttendeesAdvance: true,
  advanceNoticeText:
    "An AI Notetaker may join this meeting to record, transcribe, and prepare meeting notes.",
  emailOnRecapReady: true,
  autoShareWith: "organizer",
  recordingRetentionDays: 90,
  transcriptRetentionDays: 365,
};

export const joinRuleOptions: { value: NotetakerJoinRule; label: string; hint: string }[] = [
  { value: "all_supported", label: "All supported meetings", hint: "Join every meeting on a supported platform (Zoom, Google Meet, Teams, Webex)." },
  { value: "transovo_only", label: "Meetings booked through Transovo", hint: "Only meetings created from a Transovo booking page or appointment." },
  { value: "connected_calendar", label: "Connected calendar meetings", hint: "Any meeting detected on your connected calendars." },
  { value: "external_participants", label: "Meetings with external participants", hint: "Only join when at least one participant is outside your team." },
  { value: "selected_types", label: "Selected appointment types", hint: "Choose which booking types the Notetaker joins." },
  { value: "manual_only", label: "Manual only", hint: "The Notetaker never joins automatically — invite it per meeting." },
];

export const summaryTemplateOptions: { value: SummaryTemplateId; label: string; desc: string }[] = [
  { value: "general", label: "General", desc: "Balanced recap: topics, decisions, and next steps." },
  { value: "sales", label: "Sales", desc: "Pain points, objections, budget signals, and follow-ups." },
  { value: "consultation", label: "Consultation", desc: "Client goals, recommendations, and agreed plan." },
  { value: "customer_success", label: "Customer success", desc: "Health signals, blockers, and expansion opportunities." },
  { value: "interview", label: "Interview", desc: "Candidate responses, scorecard notes, and evaluation." },
  { value: "project_status", label: "Project / status", desc: "Progress, risks, owners, and deadlines." },
  { value: "one_on_one", label: "One-on-one", desc: "Discussion points, feedback, and commitments." },
];

export const bookingTypes = [
  { id: "initial-consultation", name: "Initial Consultation", duration: "30 min" },
  { id: "follow-up", name: "Follow-up Call", duration: "15 min" },
  { id: "demo", name: "Product Demo", duration: "45 min" },
  { id: "onboarding", name: "Onboarding Session", duration: "60 min" },
];

export const shareOptions = [
  { value: "nobody", label: "Only me", hint: "Recap is visible to you only." },
  { value: "organizer", label: "Meeting organizer", hint: "Share with whoever organized the meeting." },
  { value: "internal", label: "Internal team", hint: "Share with all internal participants." },
  { value: "all_attendees", label: "All attendees", hint: "Email the recap to every participant." },
] as const;

/** Related destinations shown in the right rail — canonical Transovo routes. */
export const relatedLinks = [
  { href: "/video", label: "Upcoming meetings" },
  { href: "/meetings", label: "Meeting recaps" },
  { href: "/integrations/calendars", label: "Connected calendars" },
  { href: "/appointments/types", label: "Per-type Notetaker overrides" },
] as const;
