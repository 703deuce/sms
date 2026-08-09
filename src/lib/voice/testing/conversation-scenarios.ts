export type ConversationScenario = {
  id: string;
  description: string;
  callerLines: string[];
  /** Minimum turns that should reach confirm_booking exposure (optional assertion). */
  expectConfirmBookingByTurn?: number;
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
