/**
 * Demo call data for Calls UI polish — used when workspace has no production calls.
 * Swap to live API data once styling is verified.
 */

export type MockCallOutcome =
  | "Resolved"
  | "Appointment Booked"
  | "Message Taken"
  | "Lead Captured"
  | "Voice"
  | "Transferred"
  | "Voicemail"
  | "No Answer";

export type MockCallRow = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  status: string;
  outcome: MockCallOutcome;
  fromE164: string;
  toE164: string;
  durationSeconds: number;
  startedAt: string;
  contactName: string;
  contactEmail?: string;
  avatarUrl?: string;
  summary: string;
  agentName: string;
  appointmentBooked?: boolean;
  transferred?: boolean;
  voicemailDetected?: boolean;
  isLead?: boolean;
  leadScore?: number;
  hasRecording: boolean;
  recordingId?: string | null;
  hasTranscript: boolean;
  serviceAddress?: string;
  reason?: string;
  intent?: string;
  sentiment?: string;
  urgency?: string;
};

export const MOCK_CALLS_METRICS = {
  answered: 47,
  leads: 12,
  appointments: 8,
  talkTimeSeconds: 13320, // 3h 42m
  answeredChangePct: 12,
  leadsChangePct: 25,
  appointmentsChangePct: 15,
  talkTimeChangePct: 20,
};

const AVATARS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jerome",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Robert",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Lisa",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=James",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jennifer",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jamie",
];

export const MOCK_CALL_ROWS: MockCallRow[] = [
  {
    id: "demo-call-jamie",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Lead Captured",
    fromE164: "+15559876543",
    toE164: "+18663464256",
    durationSeconds: 222,
    startedAt: "2024-08-13T10:45:00.000Z",
    contactName: "Jamie Allison",
    contactEmail: "jamie@allison.co",
    avatarUrl: AVATARS[9],
    summary:
      "Jamie called to inquire about service availability for her office. She expressed interest in our premium tier and requested a quote.",
    agentName: "Amy",
    isLead: true,
    leadScore: 85,
    appointmentBooked: false,
    hasRecording: true,
    recordingId: null,
    hasTranscript: true,
    serviceAddress: "Arlington, VA",
    reason: "Inquiry about premium plans",
    intent: "sales_inquiry",
    sentiment: "positive",
    urgency: "normal",
  },
  {
    id: "demo-call-1",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Resolved",
    fromE164: "+15715550182",
    toE164: "+18663464256",
    durationSeconds: 165,
    startedAt: "2024-03-18T14:32:00.000Z",
    contactName: "Jerome Bell",
    avatarUrl: AVATARS[0],
    summary:
      "Caller inquired about AC repair pricing and availability. Provided standard diagnostic fee information.",
    agentName: "Amy",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "demo-call-2",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Appointment Booked",
    fromE164: "+15715550183",
    toE164: "+18663464256",
    durationSeconds: 252,
    startedAt: "2024-03-18T13:15:00.000Z",
    contactName: "David Wilson",
    avatarUrl: AVATARS[1],
    summary:
      "Furnace not heating. Booked service appointment for Friday morning. Confirmed Arlington service area.",
    agentName: "Amy",
    appointmentBooked: true,
    hasRecording: true,
    hasTranscript: true,
    serviceAddress: "Arlington, VA",
    reason: "Furnace not heating",
  },
  {
    id: "demo-call-3",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Message Taken",
    fromE164: "+15715550184",
    toE164: "+18663464256",
    durationSeconds: 98,
    startedAt: "2024-03-18T11:42:00.000Z",
    contactName: "Sarah Mitchell",
    avatarUrl: AVATARS[2],
    summary:
      "Requested callback about water heater replacement. Left name and number for office follow-up.",
    agentName: "Amy",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "demo-call-4",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Lead Captured",
    fromE164: "+15715550185",
    toE164: "+18663464256",
    durationSeconds: 187,
    startedAt: "2024-03-17T16:20:00.000Z",
    contactName: "Michael Chen",
    avatarUrl: AVATARS[3],
    summary:
      "New homeowner asking about HVAC maintenance plans. Interested in annual service contract.",
    agentName: "Amy",
    isLead: true,
    leadScore: 72,
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "demo-call-5",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Voice",
    fromE164: "+15715550186",
    toE164: "+18663464256",
    durationSeconds: 45,
    startedAt: "2024-03-17T14:08:00.000Z",
    contactName: "Unknown Caller",
    avatarUrl: AVATARS[4],
    summary: "Brief call — caller disconnected before providing details.",
    agentName: "Amy",
    hasRecording: true,
    hasTranscript: false,
  },
  {
    id: "demo-call-6",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Appointment Booked",
    fromE164: "+15715550187",
    toE164: "+18663464256",
    durationSeconds: 310,
    startedAt: "2024-03-16T10:30:00.000Z",
    contactName: "Emily Rodriguez",
    avatarUrl: AVATARS[4],
    summary:
      "AC not cooling. Scheduled technician visit for tomorrow afternoon. Collected gate code.",
    agentName: "Amy",
    appointmentBooked: true,
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "demo-call-7",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Transferred",
    fromE164: "+15715550188",
    toE164: "+18663464256",
    durationSeconds: 142,
    startedAt: "2024-03-15T15:45:00.000Z",
    contactName: "Robert Taylor",
    avatarUrl: AVATARS[5],
    summary: "Commercial HVAC inquiry. Transferred to office manager for quote.",
    agentName: "Amy",
    transferred: true,
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "demo-call-8",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Message Taken",
    fromE164: "+15715550189",
    toE164: "+18663464256",
    durationSeconds: 76,
    startedAt: "2024-03-15T09:12:00.000Z",
    contactName: "Lisa Park",
    avatarUrl: AVATARS[6],
    summary: "Asked about weekend emergency service rates. Message sent to dispatch.",
    agentName: "Amy",
    hasRecording: true,
    hasTranscript: true,
  },
  {
    id: "demo-call-9",
    direction: "INBOUND",
    status: "COMPLETED",
    outcome: "Resolved",
    fromE164: "+15715550190",
    toE164: "+18663464256",
    durationSeconds: 203,
    startedAt: "2024-03-14T13:55:00.000Z",
    contactName: "James Wilson",
    avatarUrl: AVATARS[7],
    summary:
      "Needs HVAC service for furnace not heating. Requested callback this afternoon.",
    agentName: "Amy",
    hasRecording: true,
    hasTranscript: true,
    serviceAddress: "Arlington, VA",
    reason: "Furnace not heating",
  },
];

export const MOCK_TRANSCRIPT_SEGMENTS = [
  {
    id: "s1",
    speaker: "agent",
    text: "Hello, thank you for calling Harbor Home HVAC. This is Amy. How can I help you today?",
    startMs: 0,
    endMs: 5000,
  },
  {
    id: "s2",
    speaker: "caller",
    text: "Hi, I'm calling to get some information about your business plans and service availability for our office.",
    startMs: 5000,
    endMs: 15000,
  },
  {
    id: "s3",
    speaker: "agent",
    text: "Of course! We have several tiers depending on your needs. Do you have a specific number of employees?",
    startMs: 15000,
    endMs: 25000,
  },
  {
    id: "s4",
    speaker: "caller",
    text: "We have about 25 people in our office right now. I'd like to schedule a follow-up call for next Wednesday.",
    startMs: 25000,
    endMs: 38000,
  },
  {
    id: "s5",
    speaker: "agent",
    text: "I'd be happy to help get that information over to the team. Can I confirm your name and callback number?",
    startMs: 38000,
    endMs: 48000,
  },
  {
    id: "s6",
    speaker: "caller",
    text: "Sure — Jamie Allison. You can reach me at the number I'm calling from.",
    startMs: 48000,
    endMs: 58000,
  },
];

export const MOCK_ACTIVITY_EVENTS = [
  { id: "e1", label: "Call began", at: "10:45:00 AM" },
  { id: "e2", label: "Audio stream established", at: "10:45:02 AM" },
  { id: "e3", label: "Transcript processing started", at: "10:48:12 AM" },
  { id: "e4", label: "Summary generated", at: "10:48:45 AM" },
];

export function getMockCallById(id: string): MockCallRow | undefined {
  return MOCK_CALL_ROWS.find((c) => c.id === id);
}

export function isDemoCallId(id: string): boolean {
  return id.startsWith("demo-call");
}
