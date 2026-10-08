import type { AiReschedulerConfig } from "./types";

export type ArSmsLateActionMode = "allow" | "allow_with_warning" | "contact_business";

export type ArSmsPenaltyType =
  | "none"
  | "lost_session"
  | "percent_of_price"
  | "fixed_fee"
  | "nonrefundable_deposit"
  | "custom_text";

export type ArSmsActionPolicyConfig = {
  cutoffMinutes?: number;
  afterCutoff?: ArSmsLateActionMode;
  penaltyType?: ArSmsPenaltyType;
  penaltyPercent?: number;
  penaltyFixedAmountCents?: number;
  penaltyCustomText?: string;
};

export type ArSmsActionKind = "reschedule" | "cancel";

export type ArSmsActionEvaluation = {
  action: ArSmsActionKind;
  insideCutoff: boolean;
  minutesUntilStart: number;
  cutoffMinutes: number;
  afterCutoff: ArSmsLateActionMode;
  /** Automated SMS / calendar path allowed (R advertised, tools may run). */
  allowsAutomatedAction: boolean;
  /** Customer should be warned about a configured consequence before committing. */
  requiresPolicyWarning: boolean;
  penaltySummary: string | null;
};

const DEFAULT_AFTER_CUTOFF: ArSmsLateActionMode = "contact_business";

function resolveCutoffMinutes(
  policy: ArSmsActionPolicyConfig | undefined,
  legacyMinutes: number | undefined,
): number {
  const fromPolicy = policy?.cutoffMinutes;
  if (fromPolicy !== undefined && fromPolicy !== null) {
    const n = Number(fromPolicy);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  const legacy = Number(legacyMinutes ?? 0);
  return Number.isFinite(legacy) && legacy > 0 ? Math.floor(legacy) : 0;
}

export function resolveArRescheduleSmsPolicy(config: AiReschedulerConfig): ArSmsActionPolicyConfig {
  const cutoff = resolveCutoffMinutes(config.rescheduleSmsPolicy, config.rescheduleSmsCutoffMinutes);
  return {
    cutoffMinutes: cutoff,
    afterCutoff: config.rescheduleSmsPolicy?.afterCutoff ?? DEFAULT_AFTER_CUTOFF,
    penaltyType: config.rescheduleSmsPolicy?.penaltyType ?? "none",
    penaltyPercent: config.rescheduleSmsPolicy?.penaltyPercent,
    penaltyFixedAmountCents: config.rescheduleSmsPolicy?.penaltyFixedAmountCents,
    penaltyCustomText: config.rescheduleSmsPolicy?.penaltyCustomText,
  };
}

export function resolveArCancelSmsPolicy(config: AiReschedulerConfig): ArSmsActionPolicyConfig {
  const cutoff = resolveCutoffMinutes(config.cancelSmsPolicy, config.cancelSmsCutoffMinutes);
  return {
    cutoffMinutes: cutoff,
    afterCutoff: config.cancelSmsPolicy?.afterCutoff ?? "allow",
    penaltyType: config.cancelSmsPolicy?.penaltyType ?? "none",
    penaltyPercent: config.cancelSmsPolicy?.penaltyPercent,
    penaltyFixedAmountCents: config.cancelSmsPolicy?.penaltyFixedAmountCents,
    penaltyCustomText: config.cancelSmsPolicy?.penaltyCustomText,
  };
}

export function formatArSmsPenaltySummary(policy: ArSmsActionPolicyConfig): string | null {
  const type = policy.penaltyType ?? "none";
  if (type === "none") return null;
  if (type === "lost_session") {
    return "a prepaid session may still count toward your package";
  }
  if (type === "percent_of_price" && policy.penaltyPercent) {
    return `${policy.penaltyPercent}% of the appointment price may apply`;
  }
  if (type === "fixed_fee" && policy.penaltyFixedAmountCents) {
    const dollars = (policy.penaltyFixedAmountCents / 100).toFixed(2);
    return `a $${dollars} fee may apply`;
  }
  if (type === "nonrefundable_deposit") {
    return "a nonrefundable deposit may apply";
  }
  if (type === "custom_text" && policy.penaltyCustomText?.trim()) {
    return policy.penaltyCustomText.trim();
  }
  return null;
}

export function evaluateArSmsActionPolicy(input: {
  action: ArSmsActionKind;
  startsAt: Date;
  policy: ArSmsActionPolicyConfig;
  now?: Date;
}): ArSmsActionEvaluation {
  const now = input.now ?? new Date();
  const cutoffMinutes = Math.max(0, Math.floor(input.policy.cutoffMinutes || 0));
  const minutesUntilStart = (input.startsAt.getTime() - now.getTime()) / 60_000;
  const insideCutoff = cutoffMinutes > 0 && minutesUntilStart <= cutoffMinutes;
  const afterCutoff = input.policy.afterCutoff ?? DEFAULT_AFTER_CUTOFF;

  if (!insideCutoff) {
    return {
      action: input.action,
      insideCutoff: false,
      minutesUntilStart,
      cutoffMinutes,
      afterCutoff,
      allowsAutomatedAction: true,
      requiresPolicyWarning: false,
      penaltySummary: null,
    };
  }

  const penaltySummary = formatArSmsPenaltySummary(input.policy);
  const requiresPolicyWarning =
    afterCutoff === "allow_with_warning" && Boolean(penaltySummary);

  const allowsAutomatedAction =
    afterCutoff === "allow" || afterCutoff === "allow_with_warning";

  return {
    action: input.action,
    insideCutoff: true,
    minutesUntilStart,
    cutoffMinutes,
    afterCutoff,
    allowsAutomatedAction,
    requiresPolicyWarning,
    penaltySummary,
  };
}

export function buildArReplyInstructionsSuffix(input: {
  config: AiReschedulerConfig;
  startsAt: Date;
  now?: Date;
}): string {
  const rescheduleEval = evaluateArSmsActionPolicy({
    action: "reschedule",
    startsAt: input.startsAt,
    policy: resolveArRescheduleSmsPolicy(input.config),
    now: input.now,
  });
  const cancelEval = evaluateArSmsActionPolicy({
    action: "cancel",
    startsAt: input.startsAt,
    policy: resolveArCancelSmsPolicy(input.config),
    now: input.now,
  });

  const canReschedule = rescheduleEval.allowsAutomatedAction;
  const canCancel = cancelEval.allowsAutomatedAction;

  if (canReschedule && canCancel) {
    return " Reply C to confirm, R to reschedule, or X to cancel.";
  }
  if (canReschedule && !canCancel) {
    return " Reply C to confirm or R to reschedule.";
  }
  if (!canReschedule && canCancel) {
    return " Reply C to confirm or X to cancel. Contact the business to reschedule.";
  }
  return " Reply C to confirm. Contact the business for appointment changes.";
}
