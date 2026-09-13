import { getPrisma } from "@/lib/db";
import { loadMctbAiBookingConfig } from "@/lib/mctb/ai-booking/config";
import type {
  IntentPolicyShape,
  LeadRecoveryCollectField,
  LeadRecoveryIntent,
  LeadRecoveryWorkspaceConfig,
} from "@/lib/mctb/lead-recovery/types";
import { LEAD_RECOVERY_INTENTS } from "@/lib/mctb/lead-recovery/types";
import {
  defaultEnabledScenarios,
  intentsForEnabledScenarios,
} from "@/lib/mctb/lead-recovery/scenarios";
import type { LeadRecoveryScenarioKey } from "@/lib/mctb/lead-recovery/types";
import { computeLeadRecoveryPolicyHealth } from "@/lib/mctb/lead-recovery/policy-health";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readRawLeadRecovery(customFieldsConfig: unknown): Record<string, unknown> {
  const root = asRecord(customFieldsConfig);
  const mctb = asRecord(root.mctb);
  return asRecord(mctb.leadRecovery);
}

const DEFAULT_FALLBACK: IntentPolicyShape = {
  enabled: true,
  collect: ["NAME", "REASON"],
  actions: ["SEND_EMAIL_SUMMARY", "CUSTOMER_MESSAGE"],
  customerMessage: "Thanks — someone from our team will follow up shortly.",
};

function defaultIntentPolicies(bookingMode: "AI_BOOK" | "SEND_BOOKING_LINK" | "COLLECT_ONLY"): Partial<
  Record<LeadRecoveryIntent, IntentPolicyShape>
> {
  const bookingActions =
    bookingMode === "AI_BOOK"
      ? (["AI_BOOK"] as const)
      : bookingMode === "SEND_BOOKING_LINK"
        ? (["SEND_BOOKING_LINK"] as const)
        : (["CREATE_CALLBACK_REQUEST", "SEND_EMAIL_SUMMARY"] as const);

  return {
    OPT_OUT: {
      enabled: true,
      collect: [],
      actions: ["SUPPRESS_CONTACT", "END_AUTOMATION"],
      customerMessage: "You've been unsubscribed. Reply START to opt back in.",
    },
    WRONG_NUMBER: {
      enabled: true,
      collect: [],
      actions: ["END_AUTOMATION", "CUSTOMER_MESSAGE"],
      customerMessage: "Sorry about that — we won't message you again.",
    },
    EMERGENCY_OR_URGENT: {
      enabled: true,
      collect: ["ADDRESS", "ISSUE_DESCRIPTION"],
      actions: ["SEND_OWNER_SMS", "CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
      customerMessage: "Someone will contact you shortly.",
    },
    BOOKING_REQUEST: {
      enabled: true,
      collect: ["APPOINTMENT_PREFERENCE"],
      actions: [...bookingActions],
    },
    SPECIFIC_TIME_REQUEST: {
      enabled: true,
      collect: ["APPOINTMENT_PREFERENCE"],
      actions: [...bookingActions],
    },
    CALLBACK_REQUEST: {
      enabled: true,
      collect: ["CALLBACK_NUMBER", "CALLBACK_TIME", "REASON"],
      actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
      customerMessage: "Got it — we'll call you back as soon as we can.",
    },
    PRICING_QUESTION: {
      enabled: true,
      collect: ["ADDRESS", "SERVICE_CATEGORY"],
      mode: "ESTIMATE_REQUIRED",
      actions: ["CREATE_CALLBACK_REQUEST", "CUSTOMER_MESSAGE"],
      customerMessage:
        "I can have the team provide an exact quote. What's the service address?",
    },
    COMPLAINT: {
      enabled: true,
      collect: ["ISSUE_DESCRIPTION"],
      actions: ["ESCALATE_HUMAN", "SEND_EMAIL_SUMMARY", "CUSTOMER_MESSAGE"],
      customerMessage: "I'm sorry to hear that. I've alerted our team.",
    },
    GENERAL_INQUIRY: {
      enabled: true,
      collect: ["NAME", "REASON"],
      actions: ["SEND_EMAIL_SUMMARY", "CUSTOMER_MESSAGE"],
      customerMessage: "Thanks for reaching out — how can we help?",
    },
    SERVICE_REQUEST: {
      enabled: true,
      collect: ["ADDRESS", "ISSUE_DESCRIPTION", "URGENCY"],
      actions: ["SEND_EMAIL_SUMMARY", "CREATE_CALLBACK_REQUEST"],
    },
    UNKNOWN: {
      enabled: true,
      collect: ["REASON"],
      actions: ["CUSTOMER_MESSAGE"],
      customerMessage: "Sure — what were you calling about?",
    },
  };
}

function parseIntentList(raw: unknown): LeadRecoveryIntent[] {
  if (!Array.isArray(raw)) return [...LEAD_RECOVERY_INTENTS];
  const set = new Set(LEAD_RECOVERY_INTENTS);
  return raw.filter((x): x is LeadRecoveryIntent => typeof x === "string" && set.has(x as LeadRecoveryIntent));
}

function parsePolicy(raw: unknown): IntentPolicyShape | undefined {
  const r = asRecord(raw);
  if (!r.enabled && r.enabled !== undefined && r.enabled === false) return undefined;
  const collect = Array.isArray(r.collect) ? (r.collect as LeadRecoveryCollectField[]) : [];
  const actions = Array.isArray(r.actions) ? (r.actions as IntentPolicyShape["actions"]) : [];
  return {
    enabled: r.enabled !== false,
    collect,
    mode: typeof r.mode === "string" ? (r.mode as IntentPolicyShape["mode"]) : null,
    actions,
    customerMessage: typeof r.customerMessage === "string" ? r.customerMessage : null,
    conditions: Array.isArray(r.conditions) ? (r.conditions as IntentPolicyShape["conditions"]) : undefined,
    providerConfiguration: asRecord(r.providerConfiguration),
    escalation: asRecord(r.escalation) as IntentPolicyShape["escalation"],
  };
}

export async function loadLeadRecoveryConfig(workspaceId: string): Promise<LeadRecoveryWorkspaceConfig> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const raw = readRawLeadRecovery(ws?.customFieldsConfig);
  const aiBooking = await loadMctbAiBookingConfig(workspaceId);

  const hasStored = Object.keys(raw).length > 0;
  const enabledExplicit = raw.enabled === true;
  const enabledByAiBooking = aiBooking.enabled && !hasStored;

  const bookingMode: "AI_BOOK" | "SEND_BOOKING_LINK" | "COLLECT_ONLY" = aiBooking.enabled
    ? "AI_BOOK"
    : aiBooking.fallbackBookingLinkId
      ? "SEND_BOOKING_LINK"
      : "COLLECT_ONLY";

  const defaultPolicies = defaultIntentPolicies(bookingMode);
  const storedPolicies = asRecord(raw.intentPolicies);
  const intentPolicies: Partial<Record<LeadRecoveryIntent, IntentPolicyShape>> = {
    ...defaultPolicies,
  };
  for (const key of Object.keys(storedPolicies)) {
    const parsed = parsePolicy(storedPolicies[key]);
    if (parsed) intentPolicies[key as LeadRecoveryIntent] = parsed;
  }

  const globalMode =
    raw.globalMode === "CAPTURE_ONLY" || raw.globalMode === "INFORMATION_ONLY"
      ? raw.globalMode
      : "STANDARD";

  const enabled = enabledExplicit || enabledByAiBooking;

  const storedScenarios = asRecord(raw.enabledScenarios) as Partial<
    Record<LeadRecoveryScenarioKey, boolean>
  >;
  const enabledScenarios =
    Object.keys(storedScenarios).length > 0
      ? storedScenarios
      : defaultEnabledScenarios(aiBooking.enabled);

  const enabledIntents =
    Array.isArray(raw.enabledIntents) && raw.enabledIntents.length > 0
      ? parseIntentList(raw.enabledIntents)
      : intentsForEnabledScenarios(enabledScenarios);

  const globalBehavior = {
    tone:
      raw.globalBehavior && asRecord(raw.globalBehavior).tone === "friendly"
        ? "friendly"
        : raw.globalBehavior && asRecord(raw.globalBehavior).tone === "concise"
          ? "concise"
          : "professional",
    maxClarificationAttempts:
      typeof asRecord(raw.globalBehavior).maxClarificationAttempts === "number"
        ? (asRecord(raw.globalBehavior).maxClarificationAttempts as number)
        : 1,
    followUpEnabled: asRecord(raw.globalBehavior).followUpEnabled === true,
    followUpDelayMinutes:
      typeof asRecord(raw.globalBehavior).followUpDelayMinutes === "number"
        ? (asRecord(raw.globalBehavior).followUpDelayMinutes as number)
        : 60,
    captureOnly: globalMode === "CAPTURE_ONLY",
  };

  const paymentPolicy = {
    textToPayEnabled: asRecord(raw.paymentPolicy).textToPayEnabled === true,
    amountAuthority:
      asRecord(raw.paymentPolicy).amountAuthority === "configured_fixed_fee"
        ? "configured_fixed_fee"
        : asRecord(raw.paymentPolicy).amountAuthority === "operator_payment_request"
          ? "operator_payment_request"
          : "known_balance",
    fixedFeeAmountMinor:
      typeof asRecord(raw.paymentPolicy).fixedFeeAmountMinor === "number"
        ? (asRecord(raw.paymentPolicy).fixedFeeAmountMinor as number)
        : null,
    fixedFeeCurrency:
      typeof asRecord(raw.paymentPolicy).fixedFeeCurrency === "string"
        ? (asRecord(raw.paymentPolicy).fixedFeeCurrency as string)
        : "usd",
  };

  const serviceAreaPolicy = {
    inAreaAction:
      asRecord(raw.serviceAreaPolicy).inAreaAction === "book"
        ? "book"
        : asRecord(raw.serviceAreaPolicy).inAreaAction === "callback"
          ? "callback"
          : "continue",
    outOfAreaAction:
      asRecord(raw.serviceAreaPolicy).outOfAreaAction === "notify"
        ? "notify"
        : asRecord(raw.serviceAreaPolicy).outOfAreaAction === "handoff"
          ? "handoff"
          : "decline",
    uncertainAction:
      asRecord(raw.serviceAreaPolicy).uncertainAction === "handoff" ? "handoff" : "clarify",
  };

  const baseConfig: LeadRecoveryWorkspaceConfig = {
    enabled,
    version: typeof raw.version === "number" ? raw.version : 1,
    globalMode,
    enabledScenarios,
    enabledIntents,
    intentPolicies,
    fallbackPolicy: parsePolicy(raw.fallbackPolicy) || DEFAULT_FALLBACK,
    globalBehavior,
    paymentPolicy,
    serviceAreaPolicy,
    migratedFromAiBooking: enabledByAiBooking && !hasStored,
    collectCapabilities: Array.isArray(raw.collectCapabilities)
      ? (raw.collectCapabilities as LeadRecoveryCollectField[])
      : ["NAME", "EMAIL", "ADDRESS", "REASON", "SERVICE_CATEGORY", "URGENCY"],
    answerCapabilities: Array.isArray(raw.answerCapabilities)
      ? (raw.answerCapabilities as LeadRecoveryWorkspaceConfig["answerCapabilities"])
      : [],
    actionCapabilities: Array.isArray(raw.actionCapabilities)
      ? (raw.actionCapabilities as LeadRecoveryWorkspaceConfig["actionCapabilities"])
      : [
          "SEND_BOOKING_LINK",
          "AI_BOOK",
          "CREATE_CALLBACK_REQUEST",
          "SEND_OWNER_SMS",
          "SEND_EMAIL_SUMMARY",
          "ESCALATE_HUMAN",
        ],
    handoffTriggers: {
      uncertain: true,
      complaint: true,
      sensitive: true,
      emergency: true,
      highValue: asRecord(raw.handoffTriggers).highValue === true,
    },
    bookingLinkId:
      typeof raw.bookingLinkId === "string"
        ? raw.bookingLinkId
        : aiBooking.fallbackBookingLinkId,
    policyHealth: "DISABLED",
    scenarioHealth: {},
  };

  const health = await computeLeadRecoveryPolicyHealth(workspaceId, baseConfig);
  return {
    ...baseConfig,
    policyHealth: health.overall,
    scenarioHealth: health.scenarioHealth,
  };
}

export async function saveLeadRecoveryConfig(
  workspaceId: string,
  patch: Partial<{
    enabled: boolean;
    globalMode: LeadRecoveryWorkspaceConfig["globalMode"];
    enabledIntents: LeadRecoveryIntent[];
    enabledScenarios: Partial<Record<LeadRecoveryScenarioKey, boolean>>;
    intentPolicies: Partial<Record<LeadRecoveryIntent, IntentPolicyShape>>;
    globalBehavior: LeadRecoveryWorkspaceConfig["globalBehavior"];
    paymentPolicy: LeadRecoveryWorkspaceConfig["paymentPolicy"];
    serviceAreaPolicy: LeadRecoveryWorkspaceConfig["serviceAreaPolicy"];
    fallbackPolicy: IntentPolicyShape;
    collectCapabilities: LeadRecoveryCollectField[];
    answerCapabilities: LeadRecoveryWorkspaceConfig["answerCapabilities"];
    actionCapabilities: LeadRecoveryWorkspaceConfig["actionCapabilities"];
    handoffTriggers: LeadRecoveryWorkspaceConfig["handoffTriggers"];
    bookingLinkId: string | null;
    version: number;
  }>,
): Promise<LeadRecoveryWorkspaceConfig> {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true },
  });
  const root = asRecord(ws?.customFieldsConfig);
  const mctb = asRecord(root.mctb);
  const prev = readRawLeadRecovery(ws?.customFieldsConfig);
  const next = { ...prev, ...patch, version: patch.version ?? (typeof prev.version === "number" ? prev.version : 1) };
  const customFieldsConfig = {
    ...root,
    mctb: {
      ...mctb,
      leadRecovery: next,
    },
  };
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { customFieldsConfig },
  });
  return loadLeadRecoveryConfig(workspaceId);
}
