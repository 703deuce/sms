import { MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI } from "@/lib/mctb/launch-flags";
import { defaultIntentPolicies } from "@/lib/mctb/lead-recovery/policy-defaults";
import type {
  IntentPolicyShape,
  LeadRecoveryCollectField,
  LeadRecoveryIntent,
  LeadRecoveryWorkspaceConfig,
} from "@/lib/mctb/lead-recovery/types";
import { launchFaqIntentPolicyOverrides } from "@/lib/mctb/lead-recovery/launch-faq-policies";
import {
  defaultLaunchEnabledScenarios,
  intentsForEnabledScenarios,
} from "@/lib/mctb/lead-recovery/scenarios";
import type { LeadRecoveryScenarioKey } from "@/lib/mctb/lead-recovery/types";
import {
  simplifiedTogglesToCollectCapabilities,
  type AiRecoverySimplifiedField,
} from "@/lib/mctb/ai-recovery/simplified-fields";
import { smsCollectFieldsToCapabilities } from "@/lib/mctb/ai-recovery/collect-field-schema";
import type { MctbSmsCollectFieldDef as MctbSmsCollectFieldDefType } from "@/lib/mctb/lead-recovery/types";

const LAUNCH_ACTION_CAPABILITIES: LeadRecoveryWorkspaceConfig["actionCapabilities"] = [
  "SEND_BOOKING_LINK",
  "CREATE_CALLBACK_REQUEST",
  "SEND_EMAIL_SUMMARY",
  "SEND_OWNER_SMS",
  "CUSTOMER_MESSAGE",
  "ANSWER_APPROVED_INFORMATION",
  "ESCALATE_HUMAN",
  "END_AUTOMATION",
  "SUPPRESS_CONTACT",
];

const COLLECT_SYNC_INTENTS: LeadRecoveryIntent[] = [
  "GENERAL_INQUIRY",
  "SERVICE_REQUEST",
  "UNKNOWN",
  "CALLBACK_REQUEST",
];

const BOOKING_INTENTS: LeadRecoveryIntent[] = [
  "BOOKING_REQUEST",
  "AVAILABILITY_QUESTION",
  "SPECIFIC_TIME_REQUEST",
];

const STRIP_ACTIONS = new Set(["AI_BOOK", "FOLLOW_UP", "SEND_TEXT_TO_PAY"]);

function stripPolicyActions(policy: IntentPolicyShape): IntentPolicyShape {
  return {
    ...policy,
    mode: policy.mode === "AI_BOOK" ? "SEND_BOOKING_LINK" : policy.mode,
    actions: policy.actions.filter((a) => !STRIP_ACTIONS.has(a)),
  };
}

function collectForIntent(
  intent: LeadRecoveryIntent,
  enabled: LeadRecoveryCollectField[],
): LeadRecoveryCollectField[] {
  const set = new Set(enabled);
  if (intent === "CALLBACK_REQUEST") {
    return enabled.filter((f) =>
      ["CALLBACK_TIME", "CALLBACK_NUMBER", "REASON", "NAME", "PHONE"].includes(f),
    );
  }
  if (intent === "SERVICE_REQUEST") {
    const fields: LeadRecoveryCollectField[] = [];
    if (set.has("ADDRESS")) fields.push("ADDRESS");
    if (set.has("REASON")) fields.push("REASON", "ISSUE_DESCRIPTION");
    if (set.has("URGENCY")) fields.push("URGENCY");
    if (set.has("NAME")) fields.push("NAME");
    return fields.length ? fields : ["REASON"];
  }
  if (intent === "EMERGENCY_OR_URGENT") {
    const fields: LeadRecoveryCollectField[] = ["ISSUE_DESCRIPTION"];
    if (set.has("ADDRESS")) fields.push("ADDRESS");
    if (set.has("URGENCY")) fields.push("URGENCY");
    return fields;
  }
  return enabled.filter((f) => f !== "CALLBACK_TIME" && f !== "CALLBACK_NUMBER");
}

export type NormalizeAiRecoverySaveInput = {
  enabled: boolean;
  fieldToggles: Record<AiRecoverySimplifiedField, boolean>;
  smsCollectFields?: MctbSmsCollectFieldDefType[];
  allowDynamicCustomQuestions?: boolean;
  bookingLinkEnabled: boolean;
  bookingLinkId: string | null;
  enabledScenarios?: Partial<Record<LeadRecoveryScenarioKey, boolean>>;
  existing: LeadRecoveryWorkspaceConfig;
};

/** Launch-safe patch for simplified AI Recovery settings UI. */
export function buildAiRecoverySavePatch(
  input: NormalizeAiRecoverySaveInput,
): Partial<LeadRecoveryWorkspaceConfig> {
  const collectCapabilities = input.smsCollectFields?.length
    ? smsCollectFieldsToCapabilities(input.smsCollectFields)
    : simplifiedTogglesToCollectCapabilities(input.fieldToggles);
  const bookingMode = input.bookingLinkEnabled && input.bookingLinkId
    ? "SEND_BOOKING_LINK"
    : "COLLECT_ONLY";

  const basePolicies = {
    ...defaultIntentPolicies(bookingMode),
    ...launchFaqIntentPolicyOverrides(),
    ...input.existing.intentPolicies,
  };

  const intentPolicies: Partial<Record<LeadRecoveryIntent, IntentPolicyShape>> = {};
  for (const [key, policy] of Object.entries(basePolicies)) {
    if (!policy) continue;
    let next = stripPolicyActions(policy);
    const intentKey = key as LeadRecoveryIntent;
    if (COLLECT_SYNC_INTENTS.includes(intentKey)) {
      next = { ...next, collect: collectForIntent(intentKey, collectCapabilities) };
      if (intentKey === "GENERAL_INQUIRY") {
        next = {
          ...next,
          actions: ["ANSWER_APPROVED_INFORMATION", "SEND_EMAIL_SUMMARY", "CUSTOMER_MESSAGE"],
        };
      }
    }
    if (BOOKING_INTENTS.includes(intentKey)) {
      const bookingActions =
        bookingMode === "SEND_BOOKING_LINK"
          ? (["SEND_BOOKING_LINK"] as IntentPolicyShape["actions"])
          : (["CREATE_CALLBACK_REQUEST", "SEND_EMAIL_SUMMARY"] as IntentPolicyShape["actions"]);
      next = {
        ...next,
        collect: [],
        actions: bookingActions,
        mode: null,
      };
    }
    if (intentKey === "EMERGENCY_OR_URGENT") {
      next = {
        ...next,
        collect: collectForIntent("EMERGENCY_OR_URGENT", collectCapabilities),
      };
    }
    intentPolicies[intentKey] = next;
  }

  if (MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI) {
    const booking = intentPolicies.BOOKING_REQUEST;
    if (booking) {
      intentPolicies.BOOKING_REQUEST = {
        ...booking,
        mode: null,
        actions: booking.actions.filter((a) => a !== "AI_BOOK"),
      };
    }
  }

  const fallback = stripPolicyActions(input.existing.fallbackPolicy);
  const fallbackCollect = collectForIntent("GENERAL_INQUIRY", collectCapabilities);

  const scenarioPatch = input.enabledScenarios ?? {};
  const enabledScenarios = {
    ...defaultLaunchEnabledScenarios(),
    ...input.existing.enabledScenarios,
    ...scenarioPatch,
    // Opus AI Recovery expects FAQ answers unless the user explicitly turned the scenario off.
    general_faq:
      scenarioPatch.general_faq ??
      input.existing.enabledScenarios?.general_faq ??
      true,
  };

  return {
    enabled: input.enabled,
    smsCollectFields: input.smsCollectFields ?? input.existing.smsCollectFields,
    allowDynamicCustomQuestions:
      input.allowDynamicCustomQuestions ?? input.existing.allowDynamicCustomQuestions ?? true,
    globalMode: "STANDARD",
    enabledScenarios,
    enabledIntents: intentsForEnabledScenarios(enabledScenarios),
    intentPolicies,
    fallbackPolicy: {
      ...fallback,
      collect: fallbackCollect.length ? fallbackCollect : ["NAME", "REASON"],
    },
    collectCapabilities,
    actionCapabilities: LAUNCH_ACTION_CAPABILITIES,
    globalBehavior: {
      ...input.existing.globalBehavior,
      followUpEnabled: false,
    },
    paymentPolicy: {
      ...input.existing.paymentPolicy,
      textToPayEnabled: false,
    },
    bookingLinkId: input.bookingLinkId,
    faqPolicy: input.existing.faqPolicy?.topics?.length
      ? input.existing.faqPolicy
      : {
          topics: ["HOURS", "SERVICES", "SERVICE_AREA", "FAQ"],
          fallback: "clarify",
        },
  };
}
