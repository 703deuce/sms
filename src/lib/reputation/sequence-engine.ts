/** Quiet hours + sending window helpers (pure; timezone-aware via Intl). */

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun … 6=Sat
};

export function localPartsInTimeZone(date: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return { hour: h || 0, minute: m || 0 };
}

export function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/**
 * True when `now` is inside [windowStart, windowEnd) in the recipient timezone.
 * Windows that wrap midnight are supported (e.g. 22:00–06:00).
 */
export function isWithinSendingWindow(
  now: Date,
  timeZone: string,
  windowStart: string,
  windowEnd: string,
  sendDays?: number[]
): boolean {
  const local = localPartsInTimeZone(now, timeZone);
  if (sendDays && sendDays.length > 0 && !sendDays.includes(local.weekday)) {
    return false;
  }
  const start = parseHm(windowStart);
  const end = parseHm(windowEnd);
  const cur = minutesOfDay(local.hour, local.minute);
  const a = minutesOfDay(start.hour, start.minute);
  const b = minutesOfDay(end.hour, end.minute);
  if (a === b) return true;
  if (a < b) return cur >= a && cur < b;
  return cur >= a || cur < b;
}

/** Quiet hours = outside the allowed sending window. */
export function isQuietHour(
  now: Date,
  timeZone: string,
  windowStart: string,
  windowEnd: string
): boolean {
  return !isWithinSendingWindow(now, timeZone, windowStart, windowEnd);
}

export type SequenceCondition =
  | "message_delivered"
  | "link_clicked"
  | "customer_replied"
  | "customer_opted_out"
  | "review_detected"
  | "no_activity"
  | "valid_phone"
  | "valid_email";

export type RecipientFacts = {
  delivered: boolean;
  clicked: boolean;
  replied: boolean;
  optedOut: boolean;
  reviewDetected: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
};

export function evaluateSequenceCondition(
  condition: SequenceCondition,
  facts: RecipientFacts
): boolean {
  switch (condition) {
    case "message_delivered":
      return facts.delivered;
    case "link_clicked":
      return facts.clicked;
    case "customer_replied":
      return facts.replied;
    case "customer_opted_out":
      return facts.optedOut;
    case "review_detected":
      return facts.reviewDetected;
    case "no_activity":
      return !facts.clicked && !facts.replied && !facts.reviewDetected;
    case "valid_phone":
      return facts.hasPhone;
    case "valid_email":
      return facts.hasEmail;
    default:
      return false;
  }
}

export type SequenceStepType = "send_sms" | "send_email" | "wait" | "condition" | "end";

export type SequenceStep = {
  step_key: string;
  step_type: SequenceStepType;
  config: Record<string, unknown>;
};

export type ConditionConfig = {
  all?: string[];
  any?: string[];
  then?: string;
  else?: string;
};

function sendStepForChannel(channel: "sms" | "email" | "both"): SequenceStepType {
  if (channel === "email") return "send_email";
  return "send_sms";
}

/**
 * Channels to fire for a send_* sequence step.
 * Campaign channel is the plan (sms | email | both); step type + config.channels refine it.
 * For plan "both", default waves send SMS and email together (same step_key).
 */
export function resolveWaveChannels(params: {
  campaignChannel: "sms" | "email" | "both";
  step: SequenceStep;
  hasPhone: boolean;
  hasEmail: boolean;
}): Array<"sms" | "email"> {
  const { campaignChannel, step, hasPhone, hasEmail } = params;
  if (step.step_type !== "send_sms" && step.step_type !== "send_email") return [];

  const configured = Array.isArray(step.config.channels)
    ? (step.config.channels as unknown[]).map(String).filter((c) => c === "sms" || c === "email")
    : null;

  let wanted: Array<"sms" | "email">;
  if (configured?.length) {
    wanted = configured as Array<"sms" | "email">;
  } else if (campaignChannel === "both") {
    // Plan is multi-channel → each send wave covers both (unless step is email-only / sms-only by type and config.force_step_channel)
    if (step.config.force_step_channel === true) {
      wanted = step.step_type === "send_email" ? ["email"] : ["sms"];
    } else {
      wanted = ["sms", "email"];
    }
  } else if (campaignChannel === "email") {
    wanted = ["email"];
  } else {
    wanted = ["sms"];
  }

  // Cap by campaign plan
  if (campaignChannel === "sms") wanted = wanted.filter((c) => c === "sms");
  if (campaignChannel === "email") wanted = wanted.filter((c) => c === "email");

  let reachable = wanted.filter((c) => (c === "sms" ? hasPhone : hasEmail));

  // One-touch / prefer-single: SMS when phone exists, otherwise email (never both).
  if (step.config.prefer_single === "sms" && reachable.length > 1) {
    reachable = hasPhone ? ["sms"] : ["email"];
  } else if (step.config.prefer_single === "email" && reachable.length > 1) {
    reachable = hasEmail ? ["email"] : ["sms"];
  }

  return reachable;
}

/** Default review-request drip (initial + up to two reminders). */
export function defaultReviewRequestSequence(
  channel: "sms" | "email" | "both" = "sms"
): SequenceStep[] {
  const send = sendStepForChannel(channel);
  const sendConfig =
    channel === "both" ? { channels: ["sms", "email"] as string[] } : ({} as Record<string, unknown>);
  return [
    { step_key: "initial", step_type: send, config: { ...sendConfig } },
    { step_key: "wait_2d", step_type: "wait", config: { days: 2 } },
    {
      step_key: "reminder_1_gate",
      step_type: "condition",
      config: {
        all: ["no_activity", "customer_opted_out:false"],
        then: "reminder_1",
        else: "end",
      },
    },
    {
      step_key: "reminder_1",
      step_type: send,
      config: { template: "reminder", ...sendConfig },
    },
    { step_key: "wait_4d", step_type: "wait", config: { days: 4 } },
    {
      step_key: "reminder_2_gate",
      step_type: "condition",
      config: {
        all: ["no_activity", "customer_opted_out:false"],
        then: "reminder_2",
        else: "end",
      },
    },
    {
      step_key: "reminder_2",
      step_type: send,
      config: { template: "final", ...sendConfig },
    },
    { step_key: "end", step_type: "end", config: {} },
  ];
}

export const SEQUENCE_LIMITS = {
  /** Advanced builders may use up to 5 reminders; system templates stay ≤3 email touches + initial. */
  maxReminders: 5,
  minWaitHours: 24,
  maxSteps: 24,
} as const;

export function findStepIndex(steps: SequenceStep[], stepKey: string): number {
  return steps.findIndex((s) => s.step_key === stepKey);
}

/** Contiguous send_* steps from the start (before first wait/condition/end). */
export function initialSendSteps(steps: SequenceStep[]): SequenceStep[] {
  const out: SequenceStep[] = [];
  for (const step of steps) {
    if (step.step_type === "send_sms" || step.step_type === "send_email") {
      out.push(step);
      continue;
    }
    break;
  }
  return out;
}

export function channelForSendStep(step: SequenceStep): "sms" | "email" | null {
  if (step.step_type === "send_sms") return "sms";
  if (step.step_type === "send_email") return "email";
  return null;
}

/** Wait duration in ms from config.days / config.hours (min 1 minute for tests). */
export function waitDurationMs(config: Record<string, unknown>): number {
  const days = Number(config.days ?? 0);
  const hours = Number(config.hours ?? 0);
  const minutes = Number(config.minutes ?? 0);
  const ms = ((days * 24 + hours) * 60 + minutes) * 60_000;
  return Math.max(60_000, ms);
}

function matchConditionToken(token: string, facts: RecipientFacts): boolean {
  if (token.endsWith(":false")) {
    const cond = token.slice(0, -6) as SequenceCondition;
    return !evaluateSequenceCondition(cond, facts);
  }
  if (token.endsWith(":true")) {
    const cond = token.slice(0, -5) as SequenceCondition;
    return evaluateSequenceCondition(cond, facts);
  }
  return evaluateSequenceCondition(token as SequenceCondition, facts);
}

export function evaluateConditionConfig(
  config: ConditionConfig | Record<string, unknown>,
  facts: RecipientFacts
): boolean {
  const all = Array.isArray(config.all) ? (config.all as string[]) : [];
  const any = Array.isArray(config.any) ? (config.any as string[]) : [];
  if (all.length === 0 && any.length === 0) return true;
  const allOk = all.length === 0 || all.every((t) => matchConditionToken(t, facts));
  const anyOk = any.length === 0 || any.some((t) => matchConditionToken(t, facts));
  return allOk && anyOk;
}

export type SequenceAdvanceDecision =
  | { action: "wait"; stepIndex: number; stepKey: string; until: Date }
  | { action: "send"; stepIndex: number; stepKey: string; channel: "sms" | "email" }
  | { action: "jump"; stepIndex: number; stepKey: string }
  | { action: "end"; stepIndex: number; stepKey: string }
  | { action: "stop"; reason: "opted_out" | "invalid_step" };

/**
 * Pure step interpreter: given the step at `stepIndex`, decide the next workflow action.
 * Callers apply the decision (DB updates / enqueue) then may re-enter on the new index.
 */
export function interpretSequenceStep(
  steps: SequenceStep[],
  stepIndex: number,
  facts: RecipientFacts,
  now = new Date(),
  campaignChannel: "sms" | "email" | "both" = "sms"
): SequenceAdvanceDecision {
  if (facts.optedOut) return { action: "stop", reason: "opted_out" };
  if (stepIndex < 0 || stepIndex >= steps.length) {
    return { action: "end", stepIndex: Math.max(0, steps.length - 1), stepKey: "end" };
  }
  const step = steps[stepIndex]!;
  if (step.step_type === "end") {
    return { action: "end", stepIndex, stepKey: step.step_key };
  }
  if (step.step_type === "wait") {
    return {
      action: "wait",
      stepIndex,
      stepKey: step.step_key,
      until: new Date(now.getTime() + waitDurationMs(step.config)),
    };
  }
  if (step.step_type === "condition") {
    const cfg = step.config as ConditionConfig;
    const pass = evaluateConditionConfig(cfg, facts);
    const targetKey = String((pass ? cfg.then : cfg.else) ?? "end");
    const targetIdx = findStepIndex(steps, targetKey);
    if (targetIdx < 0) {
      return { action: "end", stepIndex, stepKey: "end" };
    }
    return { action: "jump", stepIndex: targetIdx, stepKey: targetKey };
  }
  if (step.step_type !== "send_sms" && step.step_type !== "send_email") {
    return { action: "stop", reason: "invalid_step" };
  }
  const wave = resolveWaveChannels({
    campaignChannel,
    step,
    hasPhone: facts.hasPhone,
    hasEmail: facts.hasEmail,
  });
  if (!wave.length) {
    // No reachable contact for this wave — skip to next step.
    if (stepIndex + 1 >= steps.length) {
      return { action: "end", stepIndex, stepKey: step.step_key };
    }
    return {
      action: "jump",
      stepIndex: stepIndex + 1,
      stepKey: steps[stepIndex + 1]!.step_key,
    };
  }
  // Runner expands the full wave; primary channel is first reachable.
  return { action: "send", stepIndex, stepKey: step.step_key, channel: wave[0]! };
}

/** After a send step finishes, move to the following index. */
export function indexAfterSend(steps: SequenceStep[], sendStepIndex: number): number {
  return Math.min(sendStepIndex + 1, Math.max(0, steps.length - 1));
}

export function normalizeSequenceSteps(raw: unknown): SequenceStep[] {
  if (!Array.isArray(raw) || raw.length === 0) return defaultReviewRequestSequence();
  const out: SequenceStep[] = [];
  for (const item of raw.slice(0, SEQUENCE_LIMITS.maxSteps)) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const step_key = String(row.step_key ?? "").trim();
    const step_type = String(row.step_type ?? "") as SequenceStepType;
    if (!step_key) continue;
    if (!["send_sms", "send_email", "wait", "condition", "end"].includes(step_type)) continue;
    out.push({
      step_key,
      step_type,
      config: (row.config && typeof row.config === "object"
        ? (row.config as Record<string, unknown>)
        : {}) as Record<string, unknown>,
    });
  }
  if (!out.some((s) => s.step_type === "end")) {
    out.push({ step_key: "end", step_type: "end", config: {} });
  }
  return out.length ? out : defaultReviewRequestSequence();
}

/** Validate builder sequence: max reminders, waits ≥ 24h (short initial delays allowed). */
export function validateSequenceForLaunch(steps: SequenceStep[]): string | null {
  const sends = steps.filter((s) => s.step_type === "send_sms" || s.step_type === "send_email");
  if (sends.length === 0) return "Sequence needs at least one send step.";
  if (sends.length > SEQUENCE_LIMITS.maxReminders + 1) {
    return `At most ${SEQUENCE_LIMITS.maxReminders} reminders after the initial send.`;
  }
  for (const step of steps) {
    if (step.step_type !== "wait") continue;
    const days = Number(step.config.days ?? 0);
    const hours = Number(step.config.hours ?? 0);
    const minutes = Number(step.config.minutes ?? 0);
    if (minutes > 0 && days === 0 && hours === 0) continue; // test/dev short waits
    // Initial post-service delays (2h / 3h / 4h) are intentional and allowed.
    if (step.config.allow_short === true || step.config.role === "initial_delay") continue;
    if (days * 24 + hours < SEQUENCE_LIMITS.minWaitHours) {
      return `Wait steps must be at least ${SEQUENCE_LIMITS.minWaitHours} hours.`;
    }
  }
  return null;
}

/** True when the sequence begins with a wait (post-service delay) before any send. */
export function sequenceStartsWithWait(steps: SequenceStep[]): boolean {
  return steps[0]?.step_type === "wait";
}
