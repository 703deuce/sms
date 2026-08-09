export type ConversationScenario = {
  id: string;
  description: string;
  callerLines: string[];
  /** Minimum turns that should reach confirm_booking exposure (optional assertion). */
  expectConfirmBookingByTurn?: number;
  /** Overrides default wizard field profile (frontend collectFields shape). */
  wizardProfileId?: string;
  /** LLM caller persona override for E2E runs. */
  callerPersona?: string;
  /** Goal hint for the LLM caller brain. */
  callerGoal?: string;
};

/** Scenarios mirroring real failed production calls for regression testing. */
export const CONVERSATION_SCENARIOS: Record<string, ConversationScenario> = {
  "toilet-leak": {
    id: "toilet-leak",
    description:
      "Replays the Aug 9 call: toilet leak, spoken email, address + tomorrow preference, 9:30 AM slot, confirmation.",
    callerLines: [
      "Hi, I need someone to come fix a toilet leak in my bathroom.",
      "My name is Anthony Johnson and my email is anthony at g mail dot com.",
      "The problem is a leak in the toilet, bathroom needs repair.",
      "Address is one one one four six Sunburst Lane, Fredericksburg, Virginia. I'm good for anytime tomorrow.",
      "The earlier the better.",
      "The nine thirty AM.",
      "That's good.",
      "Did you get it?",
      "Did you book it?",
    ],
    expectConfirmBookingByTurn: 7,
  },
  "simple-hvac": {
    id: "simple-hvac",
    description: "Straightforward HVAC booking with all details upfront.",
    callerLines: [
      "My furnace isn't working, I need a technician to come out.",
      "I'm Jordan Lee, phone is 555-867-5309, email jordan@example.com.",
      "The address is 421 Main Street, Fredericksburg Virginia 22401.",
      "Tomorrow morning works best.",
      "The first available time is fine.",
      "Yes, please book it.",
    ],
  },
  "pricing-then-book": {
    id: "pricing-then-book",
    description: "Caller asks pricing before booking.",
    callerLines: [
      "How much does a service call cost?",
      "Okay, I need someone for a broken AC unit.",
      "Sam Rivera, sam@example.com, 555-123-4567.",
      "88 Oak Avenue, Stafford Virginia.",
      "Next Tuesday afternoon.",
      "2 PM works.",
      "Yes, book it please.",
    ],
  },
  "garbage-disposal-phone-first": {
    id: "garbage-disposal-phone-first",
    description:
      "Different field set: name, phone, address, problem — no email. Garbage disposal repair booking.",
    wizardProfileId: "phone-address-problem",
    callerGoal: "Book a plumbing appointment for a jammed garbage disposal.",
    callerPersona: `You are Maria Santos, a homeowner calling to book a plumbing repair.
Your garbage disposal is jammed and hums but won't spin.
Your details when asked:
- Name: Maria Santos
- Phone: 703-555-0198
- Address: 2200 Princess Anne Street, Fredericksburg, Virginia 22401
- Problem: garbage disposal is jammed and won't turn on

Rules:
- Reply with ONE short natural spoken sentence (no bullet lists).
- Do NOT volunteer an email address unless the agent explicitly asks for one.
- When the agent offers appointment times, pick one of the EXACT times they listed.
- When asked to confirm booking, say yes clearly.
- Do not pretend to be the agent.
- Do not mention tools, APIs, or being an AI.`,
    callerLines: [
      "Hi, my garbage disposal is jammed and it just hums when I flip the switch.",
      "Maria Santos.",
      "You can reach me at seven zero three five five five zero one nine eight.",
      "The address is twenty-two hundred Princess Anne Street, Fredericksburg, Virginia two two four zero one.",
      "It's completely jammed and won't spin at all.",
      "Tomorrow morning works for me.",
      "The first available time is fine.",
      "Yes, please book it.",
    ],
    expectConfirmBookingByTurn: 10,
  },
};

export function listScenarioIds(): string[] {
  return Object.keys(CONVERSATION_SCENARIOS);
}

export function getScenario(id: string): ConversationScenario {
  const scenario = CONVERSATION_SCENARIOS[id];
  if (!scenario) {
    throw new Error(`Unknown scenario "${id}". Available: ${listScenarioIds().join(", ")}`);
  }
  return scenario;
}
