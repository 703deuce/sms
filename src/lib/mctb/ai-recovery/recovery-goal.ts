import type {
  LeadRecoveryScenarioKey,
  LeadRecoveryWorkspaceConfig,
  MctbAiRecoveryGoalType,
} from "@/lib/mctb/lead-recovery/types";
import { defaultLaunchEnabledScenarios } from "@/lib/mctb/lead-recovery/scenarios";

export const MCTB_AI_RECOVERY_GOAL_TYPES = ["FOLLOW_UP", "SCHEDULE", "CUSTOM"] as const;
export type { MctbAiRecoveryGoalType };

const MAX_CUSTOM_GOAL = 2_000;

export function parseMctbAiRecoveryGoalType(raw: unknown): MctbAiRecoveryGoalType | null {
  if (raw === "FOLLOW_UP" || raw === "SCHEDULE" || raw === "CUSTOM") return raw;
  return null;
}

export function normalizeCustomRecoveryGoal(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, MAX_CUSTOM_GOAL);
  return t || null;
}

/** Infer goal from persisted config when recoveryGoalType is not stored yet. */
export function inferMctbAiRecoveryGoalType(
  config: Pick<LeadRecoveryWorkspaceConfig, "enabledScenarios" | "bookingLinkId"> & {
    recoveryGoalType?: MctbAiRecoveryGoalType | null;
    customRecoveryGoal?: string | null;
  },
): MctbAiRecoveryGoalType {
  const explicit = parseMctbAiRecoveryGoalType(config.recoveryGoalType);
  if (explicit) return explicit;
  if (config.enabledScenarios?.booking === true) return "SCHEDULE";
  if (config.customRecoveryGoal?.trim()) return "CUSTOM";
  return "FOLLOW_UP";
}

/** Legacy scenario flags derived from the simplified recovery goal (not shown in UI). */
export function enabledScenariosForRecoveryGoal(
  goal: MctbAiRecoveryGoalType,
  bookingLinkEnabled: boolean,
): Partial<Record<LeadRecoveryScenarioKey, boolean>> {
  const base = { ...defaultLaunchEnabledScenarios() };
  return {
    ...base,
    take_message: true,
    general_faq: true,
    booking: goal === "SCHEDULE" && bookingLinkEnabled,
    emergencies: false,
    pricing: false,
    service_area: false,
    payments: false,
    existing_customer: false,
  };
}

export function composeRecoveryGoalPromptBlock(input: {
  goal: MctbAiRecoveryGoalType;
  customRecoveryGoal?: string | null;
}): string {
  const lines: string[] = ["RECOVERY GOAL (primary objective for this conversation)"];

  if (input.goal === "FOLLOW_UP") {
    lines.push(
      "Primary objective: Understand why the customer contacted the business, answer reasonable questions using BUSINESS KNOWLEDGE only, collect the configured information that is still missing, and let them know the team will follow up.",
      "Do not promise a specific callback time unless the customer gave one and you are acknowledging it.",
      "Do not claim an appointment is booked or that a team member will call at a guaranteed time.",
    );
  } else if (input.goal === "SCHEDULE") {
    lines.push(
      "Primary objective: Understand what the customer needs, answer reasonable questions using BUSINESS KNOWLEDGE, collect configured information that is still missing, and when they are ready to schedule, guide them to use the booking link (the system may attach the link — do not invent URLs).",
      "Do not claim an appointment exists until the customer has actually booked through the link.",
    );
  } else {
    const custom = normalizeCustomRecoveryGoal(input.customRecoveryGoal);
    lines.push(
      custom
        ? `Primary objective (business-defined): ${custom}`
        : "Primary objective: Follow the business-defined outcome below while respecting BUSINESS KNOWLEDGE and configured information collection.",
      "This custom objective does not override platform safety, compliance, or consent rules.",
    );
  }

  lines.push(
    "",
    "Information collection supports this goal — it is not a rigid questionnaire.",
    "Treat configured collect fields as objectives: if the customer already provided name, need, address, or other details in the thread, do not ask again.",
    "Ask only for missing required information, one topic at a time when needed.",
    "Stop asking once the primary objective is achieved.",
  );

  return lines.join("\n");
}
