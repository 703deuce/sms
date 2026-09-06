export type Channel = "sms" | "email";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface BookingTypeOption {
  id: string;
  name: string;
  duration: string;
  active: boolean;
}

export const BOOKING_TYPES: BookingTypeOption[] = [
  { id: "bt_1", name: "Initial Consultation", duration: "30 min", active: true },
  { id: "bt_2", name: "Water Heater Estimate", duration: "45 min", active: true },
  { id: "bt_3", name: "Follow-Up Visit", duration: "20 min", active: true },
  { id: "bt_4", name: "Deep Cleaning — Standard", duration: "2 hrs", active: false },
];

export const SUGGESTED_PROMPTS = [
  "I'd like to book a cleaning next Tuesday afternoon",
  "Do you have anything available this Friday morning?",
  "Reschedule my Thursday 2 PM appointment to next week",
  "What's your earliest availability for an estimate?",
];

export const SEED_HISTORY: ChatMessage[] = [];

export interface MockOrchestratorResult {
  type: string;
  message: string;
  intent: string;
  confidence: number;
  actions: Array<{ kind: string; detail: string }>;
  slotsChecked: number;
  timezone: string;
}

export function mockOrchestratorReply(message: string, channel: Channel): MockOrchestratorResult {
  const lower = message.toLowerCase();
  if (lower.includes("reschedule")) {
    return {
      type: "reschedule_proposal",
      message:
        "I can help with that. Your appointment on Thursday, Sep 11 at 2:00 PM can be moved. The next matching openings are Tue, Sep 16 at 10:30 AM or Wed, Sep 17 at 1:00 PM (Eastern Time). Reply with the option you prefer and I'll confirm the change and update your reminders.",
      intent: "reschedule",
      confidence: 0.93,
      actions: [
        { kind: "availability.check", detail: "2 slots matched booking type rules" },
        { kind: "reminder.pause", detail: "Pending reminders held until new time confirmed" },
      ],
      slotsChecked: 14,
      timezone: "America/New_York",
    };
  }
  if (lower.includes("available") || lower.includes("availability") || lower.includes("friday") || lower.includes("morning")) {
    return {
      type: "availability_list",
      message:
        "Here are the earliest openings this week (Eastern Time): Fri, Sep 12 at 9:00 AM · Fri, Sep 12 at 11:30 AM · Mon, Sep 15 at 8:30 AM. Reply with a time and I'll book it and send your confirmation.",
      intent: "check_availability",
      confidence: 0.96,
      actions: [{ kind: "availability.check", detail: "3 open slots across 2 booking types" }],
      slotsChecked: 22,
      timezone: "America/New_York",
    };
  }
  return {
    type: "booking_proposal",
    message:
      "I found an opening for a Deep Cleaning — Standard on Tuesday, Sep 16 at 1:00 PM (Eastern Time), approximately 2 hours. Reply YES to confirm and I'll book it and send your confirmation and reminders.",
    intent: "book_appointment",
    confidence: 0.91,
    actions: [
      { kind: "availability.check", detail: "Slot verified against Standard Hours + buffers" },
      { kind: "booking.draft", detail: "Awaiting customer confirmation (YES)" },
    ],
    slotsChecked: 9,
    timezone: "America/New_York",
  };
}

export const CAPABILITY_CARDS = [
  {
    title: "Understands booking intent",
    body: "Parses natural-language requests into structured intent, then the deterministic scheduling engine checks real availability — the AI never invents times.",
  },
  {
    title: "Books, reschedules, cancels",
    body: "Customers confirm with a reply (e.g. YES). Every change flows through the same appointment engine, reminder engine, and timeline as any other booking.",
  },
  {
    title: "Hands off with full context",
    body: "When a request needs a human, the conversation, contact, requested time, and gathered details carry forward to Messages — nothing is lost.",
  },
];
