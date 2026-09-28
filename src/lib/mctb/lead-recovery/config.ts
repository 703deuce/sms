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

import {
  DEFAULT_LEAD_RECOVERY_FALLBACK,
  defaultIntentPolicies,
} from "@/lib/mctb/lead-recovery/policy-defaults";

export { defaultIntentPolicies } from "@/lib/mctb/lead-recovery/policy-defaults";

const DEFAULT_FALLBACK = DEFAULT_LEAD_RECOVERY_FALLBACK;

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

/** Persisted Lead Recovery configuration only — no policy/provider health (safe for Overview). */
export async function loadLeadRecoveryConfigPersisted(
  workspaceId: string,
): Promise<LeadRecoveryWorkspaceConfig> {
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

  const sa = asRecord(raw.serviceAreaPolicy);
  const serviceAreaPolicy = {
    source: sa.source === "manual" ? "manual" : "workspace",
    inAreaAction:
      sa.inAreaAction === "ai_book"
        ? "ai_book"
        : sa.inAreaAction === "booking_link"
          ? "booking_link"
          : sa.inAreaAction === "callback"
            ? "callback"
            : sa.inAreaAction === "notify"
              ? "notify"
              : sa.inAreaAction === "book"
                ? "booking_link"
                : "continue",
    outOfAreaAction:
      sa.outOfAreaAction === "notify"
        ? "notify"
        : sa.outOfAreaAction === "handoff"
          ? "handoff"
          : "decline",
    uncertainAction:
      sa.uncertainAction === "handoff"
        ? "handoff"
        : sa.uncertainAction === "notify"
          ? "notify"
          : "clarify_zip",
  };

  const ec = asRecord(raw.existingCustomerPolicy);
  const existingCustomerPolicy = {
    treatDifferently: ec.treatDifferently !== false,
    actions: Array.isArray(ec.actions)
      ? (ec.actions as LeadRecoveryWorkspaceConfig["existingCustomerPolicy"]["actions"])
      : ["CREATE_CALLBACK_REQUEST", "SEND_EMAIL_SUMMARY"],
    notifyRecipientId:
      typeof ec.notifyRecipientId === "string" ? ec.notifyRecipientId : null,
  };

  const fq = asRecord(raw.faqPolicy);
  const faqPolicy = {
    topics: Array.isArray(fq.topics)
      ? (fq.topics as LeadRecoveryWorkspaceConfig["faqPolicy"]["topics"])
      : (["HOURS", "SERVICES", "FAQ"] as LeadRecoveryWorkspaceConfig["faqPolicy"]["topics"]),
    fallback:
      fq.fallback === "notify" || fq.fallback === "handoff" ? fq.fallback : "clarify",
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
    existingCustomerPolicy,
    faqPolicy,
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

  return baseConfig;
}

/** Authoritative enabled flag without policy/provider health (Handoff, shell hints). */
export async function isLeadRecoveryAiRepliesEnabled(workspaceId: string): Promise<boolean> {
  const config = await loadLeadRecoveryConfigPersisted(workspaceId);
  return config.enabled;
}

export async function loadLeadRecoveryConfig(workspaceId: string): Promise<LeadRecoveryWorkspaceConfig> {
  const baseConfig = await loadLeadRecoveryConfigPersisted(workspaceId);
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
    existingCustomerPolicy: LeadRecoveryWorkspaceConfig["existingCustomerPolicy"];
    faqPolicy: LeadRecoveryWorkspaceConfig["faqPolicy"];
    fallbackPolicy: IntentPolicyShape;
    collectCapabilities: LeadRecoveryCollectField[];
    answerCapabilities: LeadRecoveryWorkspaceConfig["answerCapabilities"];
    actionCapabilities: LeadRecoveryWorkspaceConfig["actionCapabilities"];
    handoffTriggers: LeadRecoveryWorkspaceConfig["handoffTriggers"];
    bookingLinkId: string | null;
    version: number;
  }>,
): Promise<LeadRecoveryWorkspaceConfig> {
  if (patch.enabled === true) {
    const { requireMctbCapability, MctbCapabilityDeniedError } = await import(
      "@/lib/mctb/capabilities"
    );
    try {
      await requireMctbCapability(workspaceId, "aiRecoveryEntitled");
    } catch (err) {
      if (err instanceof MctbCapabilityDeniedError) {
        throw new Error("AI Recovery requires an AI Recovery plan.");
      }
      throw err;
    }
  }

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

  if (patch.enabled === true) {
    const { saveMctbHandoffConfig } = await import("@/lib/mctb/handoff/config");
    await saveMctbHandoffConfig(workspaceId, { responseMode: "ai_conversation" }).catch(
      () => undefined,
    );
  }

  return loadLeadRecoveryConfig(workspaceId);
}
