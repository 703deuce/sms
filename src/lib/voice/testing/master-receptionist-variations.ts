import type { MasterReceptionistScenario } from "./master-receptionist-scenarios";
import {
  MASTER_RECEPTIONIST_SCENARIOS,
  getMasterScenario,
} from "./master-receptionist-scenarios";
import type { PreprodContext } from "./preprod-harness";
import { seedAgentViaFrontendWizard } from "./frontend-agent-seed";
import { seedConfirmedAppointment } from "./appointment-fixtures";
import { runConversationScenario, type SimulationReport } from "./conversation-runner";
import {
  lifecycleResultToSuiteRows,
  runBookRescheduleCancelLifecycle,
} from "./master-receptionist-journey";

export type VariationCategory =
  | "booking"
  | "reschedule"
  | "cancel"
  | "emergency"
  | "out_of_area"
  | "lifecycle";

export type MasterReceptionistVariation = {
  id: string;
  category: VariationCategory;
  description: string;
  scenario?: MasterReceptionistScenario;
  /** Run full book → reschedule → cancel journey (ignores scenario). */
  lifecycle?: boolean;
  tags?: string[];
};

const FREDERICKSBURG_ADDRESS = "421 Main Street, Fredericksburg, Virginia 22401";
const RICHMOND_ADDRESS = "999 Broad Street, Richmond, Virginia 23220";

function bookingScenario(
  id: string,
  description: string,
  callerLines: string[],
  opts?: { tags?: string[]; extra?: Partial<MasterReceptionistScenario> },
): MasterReceptionistVariation {
  const extra = opts?.extra;
  return {
    id,
    category: "booking",
    description,
    tags: opts?.tags ?? (extra?.wizardProfileId ? [extra.wizardProfileId] : undefined),
    scenario: {
      id,
      description,
      successType: "booking",
      wizardProfileId: "email-intake",
      callerGoal: "Book an HVAC service appointment.",
      callerLines,
      expectConfirmBookingByTurn: 14,
      ...extra,
    },
  };
}

/** Hand-crafted variations covering messy caller patterns. */
export const CURATED_MASTER_RECEPTIONIST_VARIATIONS: MasterReceptionistVariation[] = [
  bookingScenario(
    "var-booking-address-first",
    "Caller gives service address before being asked.",
    [
      "Hi, I need HVAC service at 421 Main Street, Fredericksburg, Virginia 22401.",
      "My AC is blowing warm air upstairs.",
      "John Smith.",
      "john.smith.test@example.com",
      "You can reach me at five seven one five five five zero one four two.",
      "Tomorrow afternoon if you have anything.",
      "The first one works.",
      "Yes, please book it.",
    ],
    { tags: ["address-first"] },
  ),
  bookingScenario(
    "var-booking-batch-intake",
    "Caller dumps name, phone, email, problem, and address in one breath.",
    [
      "Hi, I'm John Smith, five seven one five five five zero one four two, john.smith.test@example.com, my AC is blowing warm air at 421 Main Street Fredericksburg Virginia 22401.",
      "Tomorrow afternoon works.",
      "The first one is fine.",
      "Yes, book it please.",
    ],
    { tags: ["batch-intake"] },
  ),
  bookingScenario(
    "var-booking-spoken-email",
    "Email given in spoken form (must normalize).",
    [
      "My air conditioner isn't cooling.",
      "John Smith.",
      "john dot smith dot test at example dot com.",
      "571-555-0142.",
      "AC blowing warm air upstairs since yesterday.",
      FREDERICKSBURG_ADDRESS + ".",
      "Tomorrow afternoon.",
      "The first one works.",
      "Yes, that's correct.",
    ],
    { tags: ["spoken-email"] },
  ),
  bookingScenario(
    "var-booking-wrong-address-corrected",
    "Caller gives wrong city first, then corrects to in-area address.",
    [
      "I need someone to look at my AC.",
      "John Smith, john.smith.test@example.com.",
      "Actually wait, the address is 999 Broad Street Richmond Virginia — no sorry, 421 Main Street Fredericksburg Virginia 22401.",
      "The unit is blowing warm air.",
      "Tomorrow morning.",
      "The first one works.",
      "Yes, please book it.",
    ],
    { tags: ["address-correction"] },
  ),
  bookingScenario(
    "var-booking-missing-email-first",
    "Caller delays email until asked again.",
    [
      "My furnace isn't heating properly.",
      "John Smith.",
      "571-555-0142.",
      "It's not keeping up when it gets cold outside.",
      FREDERICKSBURG_ADDRESS + ".",
      "I don't have my email handy right now.",
      "john.smith.test@example.com",
      "Next available please.",
      "The first one works.",
      "Yes, book it.",
    ],
    { tags: ["late-email"] },
  ),
  bookingScenario(
    "var-booking-different-callback-phone",
    "ANI callback differs from the number caller wants on the appointment.",
    [
      "I need HVAC service, my AC isn't cooling.",
      "John Smith.",
      "If you need to reach me use six zero three five five five zero one nine nine, not this line.",
      "john.smith.test@example.com",
      "Warm air upstairs, started yesterday.",
      FREDERICKSBURG_ADDRESS + ".",
      "Tomorrow afternoon.",
      "The first one works.",
      "Yes, please book it.",
    ],
    { tags: ["different-callback-phone"] },
  ),
  bookingScenario(
    "var-booking-pricing-mid-intake",
    "Pricing question in the middle of field collection.",
    [
      "I need someone to fix my air conditioner.",
      "John Smith.",
      "Wait — how much is your service call fee?",
      "Okay, john.smith.test@example.com.",
      "571-555-0142.",
      "AC blowing warm air upstairs.",
      FREDERICKSBURG_ADDRESS + ".",
      "Tomorrow afternoon.",
      "The first one works.",
      "Yes, book it.",
    ],
    { tags: ["pricing-question"] },
  ),
  bookingScenario(
    "var-booking-slot-change",
    "Caller picks first offered slot then changes to the second.",
    [
      "My AC isn't cooling.",
      "John Smith, john.smith.test@example.com, 571-555-0142.",
      "Warm air upstairs since yesterday.",
      FREDERICKSBURG_ADDRESS + ".",
      "Tomorrow afternoon if you have anything.",
      "The first one works.",
      "Actually, can we do the second time instead?",
      "Yes, that one is better.",
      "Yes, please book it.",
    ],
    { tags: ["slot-change"] },
  ),
  bookingScenario(
    "var-booking-second-slot-direct",
    "Caller explicitly asks for the second offered time.",
    [
      "I need HVAC service for a broken AC.",
      "John Smith.",
      "john.smith.test@example.com.",
      "571-555-0142.",
      "It's blowing warm air upstairs.",
      FREDERICKSBURG_ADDRESS + ".",
      "Tomorrow afternoon.",
      "The second one please.",
      "Yes, that's correct.",
    ],
    { tags: ["second-slot"] },
  ),
  bookingScenario(
    "var-booking-hesitant-confirm",
    "Caller hesitates before confirming, then says yes clearly.",
    [
      "Air conditioner not cooling.",
      "John Smith, john.smith.test@example.com, 571-555-0142.",
      "AC warm air upstairs.",
      FREDERICKSBURG_ADDRESS + ".",
      "Tomorrow afternoon.",
      "The first one works.",
      "Let me think — yes, that's correct, please book it.",
    ],
    { tags: ["hesitant-confirm"] },
  ),
  bookingScenario(
    "var-booking-problem-first",
    "Caller leads with detailed problem before identity.",
    [
      "The AC upstairs has been blowing warm air since yesterday and the thermostat says cool but it isn't.",
      "I'd like to schedule a service visit.",
      "John Smith.",
      "john.smith.test@example.com.",
      "571-555-0142.",
      FREDERICKSBURG_ADDRESS + ".",
      "Tomorrow afternoon.",
      "The first one works.",
      "Yes, please book it.",
    ],
    { tags: ["problem-first"] },
  ),
  {
    id: "var-reschedule-thursday-vague",
    category: "reschedule",
    description: "Reschedule with vague Thursday preference (requires seeded appointment).",
    scenario: {
      ...getMasterScenario("call-2-reschedule"),
      id: "var-reschedule-thursday-vague",
      callerLines: [
        "Hi, I need to move my appointment.",
        "John Smith, john.smith.test@example.com.",
        "Can we do later in the week, maybe Thursday morning?",
        "The first one works.",
        "Yes, please reschedule it.",
      ],
    },
    tags: ["requires-prior-appointment"],
  },
  {
    id: "var-reschedule-identity-spelled",
    category: "reschedule",
    description: "Reschedule with spelled-out identity confirmation.",
    scenario: {
      ...getMasterScenario("call-2-reschedule"),
      id: "var-reschedule-identity-spelled",
      callerLines: [
        "I need to reschedule my appointment.",
        "John Smith, J-O-H-N S-M-I-T-H, same phone I used before.",
        "How about tomorrow afternoon?",
        "The first one works.",
        "Yes, please reschedule it.",
      ],
    },
    tags: ["requires-prior-appointment"],
  },
  {
    id: "var-cancel-hesitation",
    category: "cancel",
    description: "Cancel after brief hesitation.",
    scenario: {
      ...getMasterScenario("call-3-cancel"),
      id: "var-cancel-hesitation",
      callerLines: [
        "I need to cancel my appointment.",
        "John Smith.",
        "Are you sure you need me to confirm?",
        "Yes, please cancel it.",
      ],
    },
    tags: ["requires-prior-appointment"],
  },
  {
    id: "var-cancel-reschedule-then-cancel",
    category: "cancel",
    description: "Caller starts with reschedule intent then switches to cancel.",
    scenario: {
      id: "var-cancel-reschedule-then-cancel",
      description: "Caller says reschedule then actually cancels.",
      successType: "cancel",
      requiresPriorAppointment: true,
      callerGoal: "Cancel your appointment after initially asking to reschedule.",
      callerLines: [
        "Hi, I need to reschedule my appointment.",
        "Actually you know what, just cancel it please.",
        "John Smith, same phone as before.",
        "Yes, please cancel it.",
      ],
    },
    tags: ["requires-prior-appointment", "intent-switch"],
  },
  {
    id: "var-emergency-gas-basement",
    category: "emergency",
    description: "Gas smell emergency with basement detail.",
    scenario: {
      ...getMasterScenario("call-4-emergency"),
      id: "var-emergency-gas-basement",
      callerLines: [
        "I smell gas in the basement near the furnace, this is an emergency.",
        "Yes it's a strong smell.",
        "Please get someone on the line right away.",
      ],
    },
  },
  {
    id: "var-out-of-area-richmond-then-message",
    category: "out_of_area",
    description: "Richmond out-of-area caller accepts message taking.",
    scenario: {
      ...getMasterScenario("call-5-out-of-area"),
      id: "var-out-of-area-richmond-then-message",
      callerLines: [
        `I need HVAC service at ${RICHMOND_ADDRESS}.`,
        "The air conditioner is broken.",
        "Okay, can someone call me back then?",
      ],
    },
  },
  {
    id: "var-lifecycle-full",
    category: "lifecycle",
    description: "Full book → reschedule → cancel lifecycle on one tenant (3 calls).",
    lifecycle: true,
    tags: ["lifecycle"],
  },
];

const FIRST_NAMES = [
  "John",
  "Jane",
  "Michael",
  "Sarah",
  "David",
  "Emily",
  "Robert",
  "Lisa",
  "James",
  "Maria",
];
const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Davis",
  "Miller",
  "Wilson",
  "Moore",
  "Taylor",
  "Anderson",
];
const IN_AREA_STREETS = [
  "421 Main Street, Fredericksburg, Virginia 22401",
  "88 Oak Avenue, Stafford, Virginia 22554",
  "15 Liberty Lane, Spotsylvania, Virginia 22553",
  "902 Hanover Street, Fredericksburg, Virginia 22401",
];
const PROBLEMS = [
  "The AC is blowing warm air upstairs.",
  "The furnace won't stay on.",
  "There's a water leak under the air handler.",
  "The thermostat isn't responding.",
  "We have no cooling on the second floor.",
];

function seededIndex(seed: number, modulo: number): number {
  return Math.abs(seed) % modulo;
}

/**
 * Generate parameterized booking variations for scale testing (50–100+).
 * Same workflow capabilities, different caller data each seed.
 */
export function generateBookingVariation(seed: number): MasterReceptionistVariation {
  const first = FIRST_NAMES[seededIndex(seed, FIRST_NAMES.length)]!;
  const last = LAST_NAMES[seededIndex(seed + 7, LAST_NAMES.length)]!;
  const name = `${first} ${last}`;
  const emailLocal = `${first.toLowerCase()}.${last.toLowerCase()}.test`;
  const email = `${emailLocal}@example.com`;
  const phoneSuffix = String(1000 + seededIndex(seed * 13, 9000)).padStart(4, "0");
  const address = IN_AREA_STREETS[seededIndex(seed + 3, IN_AREA_STREETS.length)]!;
  const problem = PROBLEMS[seededIndex(seed + 11, PROBLEMS.length)]!;
  const id = `gen-booking-${seed}`;

  return bookingScenario(
    id,
    `Generated booking variation #${seed} (${name}, ${address.split(",")[0]}).`,
    [
      `Hi, I'm ${name} and ${problem.toLowerCase().replace(/\.$/, "")}.`,
      `My email is ${email}.`,
      `You can call me at five seven one five five five ${phoneSuffix.slice(0, 2)} ${phoneSuffix.slice(2)}.`,
      address + ".",
      seed % 2 === 0 ? "Tomorrow afternoon." : "Next available morning slot.",
      seed % 3 === 0 ? "The second one works." : "The first one works.",
      "Yes, please book it.",
    ],
    { tags: ["generated", `seed-${seed}`] },
  );
}

export function listCuratedVariationIds(): string[] {
  return CURATED_MASTER_RECEPTIONIST_VARIATIONS.map((v) => v.id);
}

export function getMasterReceptionistVariation(id: string): MasterReceptionistVariation {
  const curated = CURATED_MASTER_RECEPTIONIST_VARIATIONS.find((v) => v.id === id);
  if (curated) return curated;

  const genMatch = /^gen-booking-(\d+)$/.exec(id);
  if (genMatch) {
    return generateBookingVariation(Number(genMatch[1]));
  }

  if (id in MASTER_RECEPTIONIST_SCENARIOS) {
    const base = getMasterScenario(id);
    return {
      id,
      category:
        base.successType === "booking"
          ? "booking"
          : base.successType === "reschedule"
            ? "reschedule"
            : base.successType === "cancel"
              ? "cancel"
              : base.successType === "emergency_transfer"
                ? "emergency"
                : "out_of_area",
      description: base.description,
      scenario: base,
    };
  }

  throw new Error(
    `Unknown variation "${id}". Curated: ${listCuratedVariationIds().join(", ")}; or gen-booking-<seed>`,
  );
}

export function buildVariationBatch(input: {
  curated?: boolean;
  generatedCount?: number;
  categories?: VariationCategory[];
}): MasterReceptionistVariation[] {
  const out: MasterReceptionistVariation[] = [];

  if (input.curated !== false) {
    out.push(...CURATED_MASTER_RECEPTIONIST_VARIATIONS);
  }

  const genCount = input.generatedCount ?? 0;
  for (let i = 0; i < genCount; i++) {
    out.push(generateBookingVariation(i + 1));
  }

  if (input.categories?.length) {
    return out.filter((v) => input.categories!.includes(v.category));
  }

  return out;
}

export const DEFAULT_VARIATION_BATCH_SIZE = 50;

export type VariationRunResult = {
  variationId: string;
  category: VariationCategory;
  passed: boolean;
  turns: number;
  failures: string[];
  bookingId: string | null;
  steps?: Array<{ scenarioId: string; passed: boolean; turns: number }>;
};

function seedScenarioForVariation(variation: MasterReceptionistVariation): MasterReceptionistScenario {
  if (variation.scenario) return variation.scenario;
  if (variation.lifecycle) return getMasterScenario("call-1-hvac-booking");
  throw new Error(`Variation "${variation.id}" has no scenario or lifecycle flag`);
}

/**
 * Run one variation in an isolated preprod tenant (lifecycle reuses one tenant for 3 calls).
 */
export async function runMasterReceptionistVariation(input: {
  variation: MasterReceptionistVariation;
  ctx: PreprodContext;
  callerPhone: string;
  serviceName?: string;
  llmCaller?: boolean;
}): Promise<{ serviceName: string; result: VariationRunResult }> {
  const seedScenario = seedScenarioForVariation(input.variation);
  const { serviceName } = await seedAgentViaFrontendWizard({
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
    phoneNumberE164: input.callerPhone,
    scenario: seedScenario,
  });
  const resolvedServiceName = input.serviceName ?? serviceName;

  if (input.variation.lifecycle) {
    const lifecycle = await runBookRescheduleCancelLifecycle({
      ctx: input.ctx,
      callerPhone: input.callerPhone,
      serviceName: resolvedServiceName,
      llmCaller: input.llmCaller,
    });
    return {
      serviceName: resolvedServiceName,
      result: {
        variationId: input.variation.id,
        category: input.variation.category,
        passed: lifecycle.passed,
        turns: lifecycle.steps.reduce((sum, s) => sum + s.turns, 0),
        failures: lifecycle.passed ? [] : lifecycle.steps.flatMap((s) => s.failures),
        bookingId: lifecycle.appointmentId,
        steps: lifecycle.steps.map((s) => ({
          scenarioId: s.scenarioId,
          passed: s.passed,
          turns: s.turns,
        })),
      },
    };
  }

  const scenario = input.variation.scenario!;
  let priorAppointmentId: string | undefined;
  let priorStartsAt: Date | undefined;

  if (scenario.requiresPriorAppointment) {
    const seeded = await seedConfirmedAppointment({
      workspaceId: input.ctx.workspaceId,
      agentId: input.ctx.agentId,
      callId: `seed-${Date.now()}`,
      callerPhone: input.callerPhone,
      contactName: "John Smith",
      serviceName: resolvedServiceName,
    });
    priorAppointmentId = seeded.appointmentId;
    priorStartsAt = seeded.startsAt;
  }

  const report = await runConversationScenario({
    scenario,
    ctx: input.ctx,
    callerPhone: input.callerPhone,
    serviceName: resolvedServiceName,
    llmCaller: input.llmCaller,
    maxTurns:
      scenario.successType === "reschedule" || scenario.successType === "cancel" ? 15 : 25,
    priorAppointmentId,
    priorStartsAt,
  });

  return {
    serviceName: resolvedServiceName,
    result: {
      variationId: input.variation.id,
      category: input.variation.category,
      passed: report.passed,
      turns: report.turns,
      failures: report.failures,
      bookingId: report.bookingId,
    },
  };
}

export function variationResultToSuiteRow(result: VariationRunResult): {
  scenario: string;
  passed: boolean;
  turns: number;
  failures: string[];
  bookingId: string | null;
} {
  return {
    scenario: result.variationId,
    passed: result.passed,
    turns: result.turns,
    failures: result.failures,
    bookingId: result.bookingId,
  };
}

export function summarizeVariationReports(reports: VariationRunResult[]): {
  passed: boolean;
  total: number;
  passedCount: number;
  failed: VariationRunResult[];
} {
  const failed = reports.filter((r) => !r.passed);
  return {
    passed: failed.length === 0,
    total: reports.length,
    passedCount: reports.length - failed.length,
    failed,
  };
}
