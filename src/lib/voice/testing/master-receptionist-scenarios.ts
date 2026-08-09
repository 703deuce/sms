import type { ConversationScenario } from "./conversation-scenarios";

export type ScenarioSuccessType =
  | "booking"
  | "reschedule"
  | "cancel"
  | "out_of_area"
  | "emergency_transfer";

export type MasterReceptionistScenario = ConversationScenario & {
  successType: ScenarioSuccessType;
  /** Reuse an appointment booked or seeded before this call. */
  requiresPriorAppointment?: boolean;
  /** Skip forced book-intent bootstrap (default true for all). */
  detectIntentFromCaller?: boolean;
};

const JOHN_SMITH_PERSONA = `You are John Smith, a homeowner calling for HVAC service.
Your details when asked:
- Name: John Smith
- Phone: 571-555-0142
- Email: john.smith.test@example.com
- Problem: The AC is blowing warm air upstairs, started yesterday
- Address: 421 Main Street, Fredericksburg, Virginia 22401

Rules:
- Reply with ONE short natural spoken sentence (no bullet lists).
- When the agent offers appointment times, pick one of the EXACT times they listed.
- When asked to confirm booking or reschedule, say yes clearly.
- Do not pretend to be the agent.
- Do not mention tools, APIs, or being an AI.`;

export const MASTER_RECEPTIONIST_SCENARIOS: Record<string, MasterReceptionistScenario> = {
  "call-1-hvac-booking": {
    id: "call-1-hvac-booking",
    description:
      "CALL 1 — New service booking: AC not cooling, pricing question, intake, availability, book, confirm.",
    successType: "booking",
    wizardProfileId: "email-intake",
    callerGoal: "Book an HVAC service appointment for AC blowing warm air.",
    callerPersona: JOHN_SMITH_PERSONA,
    callerLines: [
      "Hi, my air conditioner isn't cooling and I need someone to come out and take a look.",
      "I'd like to schedule a service appointment.",
      "Before we go further, how much is your service call fee?",
      "John Smith.",
      "You can reach me at five seven one five five five zero one four two.",
      "john.smith.test@example.com",
      "The AC is blowing warm air upstairs, it started yesterday.",
      "421 Main Street, Fredericksburg, Virginia 22401.",
      "Tomorrow afternoon if you have anything, or the next available.",
      "The first one works.",
      "Yes, that's correct, please book it.",
      "Great, thank you. That's all I need.",
    ],
    expectConfirmBookingByTurn: 12,
  },
  "call-2-reschedule": {
    id: "call-2-reschedule",
    description: "CALL 2 — Reschedule existing appointment (same phone as Call 1).",
    successType: "reschedule",
    requiresPriorAppointment: true,
    callerGoal: "Reschedule your existing HVAC appointment to later in the week.",
    callerPersona: JOHN_SMITH_PERSONA,
    callerLines: [
      "Hi, I need to reschedule my appointment.",
      "John Smith.",
      "Can we move it to later in the week, maybe Thursday morning?",
      "The first one works.",
      "Yes, please reschedule it.",
    ],
  },
  "call-3-cancel": {
    id: "call-3-cancel",
    description: "CALL 3 — Cancel existing appointment (same phone as Call 1).",
    successType: "cancel",
    requiresPriorAppointment: true,
    callerGoal: "Cancel your existing HVAC appointment.",
    callerPersona: JOHN_SMITH_PERSONA,
    callerLines: [
      "I need to cancel my appointment.",
      "John Smith, same phone number I used before.",
      "Yes, please cancel it.",
    ],
  },
  "call-4-emergency": {
    id: "call-4-emergency",
    description: "CALL 4 — Gas smell emergency should trigger urgent transfer or handoff.",
    successType: "emergency_transfer",
    callerGoal: "Report a gas smell emergency near the furnace.",
    callerPersona: `You are John Smith reporting an emergency at home.
Rules:
- Reply with ONE short natural spoken sentence.
- You smell gas near your furnace and need immediate help.
- Do not pretend to be the agent.`,
    callerLines: [
      "I smell gas near my furnace, this is an emergency.",
      "Yes, it's a strong gas smell in the basement.",
      "Please connect me with someone right away.",
    ],
  },
  "call-5-out-of-area": {
    id: "call-5-out-of-area",
    description: "CALL 5 — Richmond address is outside the Fredericksburg service area.",
    successType: "out_of_area",
    callerGoal: "Request HVAC service at an out-of-area Richmond address.",
    callerPersona: `You are a homeowner in Richmond, Virginia.
Rules:
- Reply with ONE short natural spoken sentence.
- Your address is 999 Broad Street, Richmond, Virginia 23220.
- If told you're out of area, accept that politely.`,
    callerLines: [
      "I need HVAC service at 999 Broad Street, Richmond, Virginia 23220.",
      "It's for a broken air conditioner.",
      "Okay, I understand. Can you take a message?",
    ],
  },
};

export function listMasterScenarioIds(): string[] {
  return Object.keys(MASTER_RECEPTIONIST_SCENARIOS);
}

export function getMasterScenario(id: string): MasterReceptionistScenario {
  const scenario = MASTER_RECEPTIONIST_SCENARIOS[id];
  if (!scenario) {
    throw new Error(
      `Unknown master scenario "${id}". Available: ${listMasterScenarioIds().join(", ")}`,
    );
  }
  return scenario;
}

export const MASTER_RECEPTIONIST_SUITE_ORDER = [
  "call-1-hvac-booking",
  "call-2-reschedule",
  "call-3-cancel",
] as const;

export const MASTER_RECEPTIONIST_OPTIONAL_SCENARIOS = [
  "call-4-emergency",
  "call-5-out-of-area",
] as const;
