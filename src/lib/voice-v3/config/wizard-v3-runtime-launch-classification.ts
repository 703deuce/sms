/**
 * Launch-time classification for wizard manifest leaves.
 * Separates stale CONFIGURED_NOT_IMPLEMENTED rows from real customer-visible gaps.
 *
 * Evidence pointers are module paths — not exhaustive line citations.
 */

export type WizardV3LaunchClassification =
  | "CURRENT_VISIBLE_IMPLEMENTED"
  | "CURRENT_VISIBLE_STILL_BROKEN"
  | "CHILD_IMPLEMENTED_BY_PARENT"
  | "CONTROL_PLANE_ACTIVE"
  | "HIDDEN_STATE_ONLY"
  | "OUT_OF_SCOPE_RETIRED"
  | "MCTB_ONLY"
  | "LEGACY_OBSOLETE"
  | "UI_METADATA_ONLY";

export type WizardV3LaunchClassificationRow = {
  statePath: string;
  classification: WizardV3LaunchClassification;
  evidence: string;
  runtimeConsumer?: string;
};

const EXACT: Record<string, Omit<WizardV3LaunchClassificationRow, "statePath">> = {
  // —— Send booking link (runtime exists; manifest was stale) ——
  bookingLinkUrl: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence:
      "compile-voice-v3-agent-config → bookingStrategyDetail; authorize + executeSendBookingLink",
    runtimeConsumer: "send_booking_link tool + SMS body",
  },
  bookingLinkLabel: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "buildSendBookingLinkSmsBody / resolveSendLinkConfig",
    runtimeConsumer: "SMS label text",
  },
  // —— Out of launch scope ——
  calendlyEventTypeUri: {
    classification: "OUT_OF_SCOPE_RETIRED",
    evidence: "V1 Voice launch: Microsoft + Send Link only",
  },
  calendlyEventTypeName: { classification: "OUT_OF_SCOPE_RETIRED", evidence: "same" },
  calendlyEventTypeDurationMin: { classification: "OUT_OF_SCOPE_RETIRED", evidence: "same" },
  calendlyTimezone: { classification: "OUT_OF_SCOPE_RETIRED", evidence: "same" },
  crmEnabled: {
    classification: "OUT_OF_SCOPE_RETIRED",
    evidence: "Activate step CRM toggle — not V1 Voice runtime",
  },
  // —— KB setup vs runtime RAG ——
  knowledgeSource: {
    classification: "UI_METADATA_ONLY",
    evidence: "information-step.tsx — drives KB provisioning UX, not per-call tool args",
  },
  websiteUrl: {
    classification: "UI_METADATA_ONLY",
    evidence: "information-step crawl/import — indexes KB; retrieval via search_business_knowledge",
  },
  linkedKnowledgeBaseId: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "compile-voice-v3-agent-config retrievalEnabled + resolve-agent-knowledge-retrieval",
    runtimeConsumer: "search_business_knowledge",
  },
  knowledgeBaseEnabled: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "compile retrievalEnabled gate",
    runtimeConsumer: "search_business_knowledge authorization",
  },
  knowledgeBaseRevision: {
    classification: "CHILD_IMPLEMENTED_BY_PARENT",
    evidence: "Compiled into retrieval.revision for cache busting",
  },
  answerWhen: {
    classification: "CURRENT_VISIBLE_STILL_BROKEN",
    evidence:
      "Compiled to telephony.answerWhen; Voice V3 LiveKit ingress does not gate answer timing from this field alone",
  },
  ringBehavior: {
    classification: "CURRENT_VISIBLE_STILL_BROKEN",
    evidence:
      "Compiled to telephony.ringBehavior; LiveKit ingress path does not implement ring_team_first semantics",
  },
  ringTeamSeconds: {
    classification: "CHILD_IMPLEMENTED_BY_PARENT",
    evidence: "Only meaningful when ringBehavior ring_team is honored",
  },
  // —— Outbound SMS ——
  outboundSmsMode: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "telephony.* → executeSendBookingLink + resolve-voice-v3-outbound-sms",
  },
  outboundSmsPhoneNumberId: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "sendVoiceV3BookingLinkSms phoneNumberId",
  },
  outboundSmsE164: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "resolveSendLinkSenderE164",
  },
  // —— Operating maturity ——
  "operatingMaturity.businessSchedule.timezone": {
    classification: "CHILD_IMPLEMENTED_BY_PARENT",
    evidence: "resolveVoiceV2OperatingState + compile timezone",
  },
  "operatingMaturity.onCall": {
    classification: "HIDDEN_STATE_ONLY",
    evidence: "Legacy aggregate flag; onCallSchedule is the editable surface",
  },
  "operatingMaturity.sla": {
    classification: "HIDDEN_STATE_ONLY",
    evidence: "Callback SLA display metadata — not separate executor",
  },
  "operatingMaturity.afterHoursBehavior.useOperatingStateDuringCalls": {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "behavior-gating.ts gateCapabilitiesForOperatingState",
  },
  "operatingMaturity.afterHoursBehavior.whenClosed.allowLiveBooking": {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "effective-tool-authorization.ts liveBookingAllowed",
  },
  "operatingMaturity.afterHoursBehavior.whenClosed.allowCallbackRequest": {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "effective-tool-authorization request_callback gate",
  },
  "operatingMaturity.afterHoursBehavior.whenClosed.allowMessageTaking": {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "effective-tool-authorization take_message gate",
  },
  "operatingMaturity.afterHoursBehavior.whenClosed.allowOnCallEscalation": {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "authorize-transfer on-call escalation route",
  },
  "operatingMaturity.afterHoursBehavior.whenClosed.allowOfficeTransfer": {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "behavior-gating officeTransferAllowed",
  },
  "operatingMaturity.afterHoursBehavior.whenClosed.allowNormalTransferDestinations": {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "behavior-gating normal transfer destinations",
  },
  "operatingMaturity.onCallSchedule.enabled": {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "resolveActiveOnCallTarget in authorize-transfer",
  },
  "operatingMaturity.callbackSla.normalTarget": {
    classification: "UI_METADATA_ONLY",
    evidence: "Ops display / future SLA — no separate call tool",
  },
  "operatingMaturity.callbackSla.normalCustomMinutes": {
    classification: "UI_METADATA_ONLY",
    evidence: "same",
  },
  "operatingMaturity.callbackSla.urgentTarget": {
    classification: "UI_METADATA_ONLY",
    evidence: "same",
  },
  "operatingMaturity.callbackSla.urgentCustomMinutes": {
    classification: "UI_METADATA_ONLY",
    evidence: "same",
  },
  // —— Qualification ——
  qualificationEnabled: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "evaluate-voice-v3-qualification + effective-tool-authorization",
  },
  qualificationRequiredBeforePrimaryAction: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "isQualificationBlockingCalendarActions",
  },
  qualificationRevision: {
    classification: "UI_METADATA_ONLY",
    evidence: "Wizard revision counter",
  },
  qualificationRulesMatchMode: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "evaluateVoiceV3Qualification rules ALL/ANY",
  },
  qualificationNotQualifiedFallback: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "Compiled to qualification config (prompt + gating)",
  },
  qualificationNeedsReviewFallback: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "same",
  },
  "qualificationSupportedZipCodes[]": {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "zipSupported in evaluate-qualification",
  },
  // —— Transfer / urgency / callback ——
  warmTransfer: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "compile-transfer-config defaultMode WARM",
  },
  detectVoicemailOnTransfer: {
    classification: "CURRENT_VISIBLE_STILL_BROKEN",
    evidence:
      "Compiled to callHandling but Voice V3 LiveKit transfer execution plan does not pass AMD flag (lib/voice/transfers.ts only legacy path)",
  },
  voiceV2HumanTransferEnabled: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "effective-tool-authorization transfer_call gate",
  },
  allowCallerRequestedTransfer: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "authorize-transfer caller-requested guard",
  },
  transferRouting: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "compile-transfer-config routing waterfall",
  },
  defaultTransferPlanId: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "compile-transfer-config routes",
  },
  urgencyEnabled: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "evaluateVoiceV3Urgency",
  },
  callbackUseAniByDefault: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "callback-requirements phoneSatisfied + astra-callback-instructions",
  },
  callbackAskPreferredTime: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "execute-request-callback requires preferred_time + astra-callback-instructions",
  },
  callbackConfirmNumber: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "astra-callback-instructions confirm-number policy (prompt-enforced)",
  },
  salesSolicitationEnabled: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "spam-protection/types normalizeSpamProtectionFromWizard",
  },
  salesSolicitationAction: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "maps to solicitorPolicy + report_unwanted_solicitor",
  },
  // —— AI call recovery ——
  aiCallRecoveryEnabled: {
    classification: "CURRENT_VISIBLE_IMPLEMENTED",
    evidence: "post-call/ai-call-recovery-sms.ts",
  },
  aiCallRecoveryConsentMode: {
    classification: "CHILD_IMPLEMENTED_BY_PARENT",
    evidence: "recovery config consumed by post-call SMS",
  },
  aiCallRecoverySendingPhoneNumberId: {
    classification: "CHILD_IMPLEMENTED_BY_PARENT",
    evidence: "same",
  },
  aiCallRecoveryContinueOverSms: {
    classification: "CHILD_IMPLEMENTED_BY_PARENT",
    evidence: "same",
  },
  aiCallRecoveryDelaySeconds: {
    classification: "CHILD_IMPLEMENTED_BY_PARENT",
    evidence: "same",
  },
  aiCallRecoverySendWhenCallbackCreated: {
    classification: "CHILD_IMPLEMENTED_BY_PARENT",
    evidence: "same",
  },
};

function patternRules(): Array<{
  pattern: RegExp;
  row: Omit<WizardV3LaunchClassificationRow, "statePath">;
}> {
  return [
    {
      pattern: /^operatingMaturity\.businessSchedule\.holidays\[\]\./,
      row: {
        classification: "CURRENT_VISIBLE_IMPLEMENTED",
        evidence: "resolveVoiceV2OperatingState holiday closure",
        runtimeConsumer: "operating state + tool gating",
      },
    },
    {
      pattern: /^operatingMaturity\.onCallSchedule\.entries\[\]\./,
      row: {
        classification: "CHILD_IMPLEMENTED_BY_PARENT",
        evidence: "resolveActiveOnCallTarget reads schedule entries",
      },
    },
    {
      pattern: /^qualificationRules\[\]\./,
      row: {
        classification: "CURRENT_VISIBLE_IMPLEMENTED",
        evidence: "evaluateVoiceV3Qualification rule rows",
      },
    },
    {
      pattern: /^urgencyRules\[\]\./,
      row: {
        classification: "CURRENT_VISIBLE_IMPLEMENTED",
        evidence: "evaluateVoiceV3Urgency",
      },
    },
    {
      pattern: /^transferPlanSteps\[\]\./,
      row: {
        classification: "CHILD_IMPLEMENTED_BY_PARENT",
        evidence: "compile-transfer-config builds waterfall routes",
      },
    },
    {
      pattern: /^appointmentTypes\[\]\.id$/,
      row: {
        classification: "HIDDEN_STATE_ONLY",
        evidence: "Stable row id — not customer semantics",
      },
    },
    {
      pattern: /^appointmentTypes\[\]\.name$/,
      row: {
        classification: "CURRENT_VISIBLE_IMPLEMENTED",
        evidence: "Amy context + service selection (compile services)",
      },
    },
    {
      pattern: /^appointmentTypes\[\]\.calendar$/,
      row: {
        classification: "CURRENT_VISIBLE_IMPLEMENTED",
        evidence: "wizardServices → Microsoft calendar id per type",
      },
    },
    {
      pattern: /^appointmentTypes\[\]\.minNotice$/,
      row: {
        classification: "CURRENT_VISIBLE_IMPLEMENTED",
        evidence: "service-policy minimumBookingNoticeMinutes",
      },
    },
    {
      pattern: /^appointmentTypes\[\]\.maxDaysAhead$/,
      row: {
        classification: "CURRENT_VISIBLE_IMPLEMENTED",
        evidence: "service-policy maximumBookingDaysAhead",
      },
    },
    {
      pattern: /^appointmentTypes\[\]\.bookingPermission$/,
      row: {
        classification: "CURRENT_VISIBLE_IMPLEMENTED",
        evidence: "service-policy serviceAllowsLiveBooking",
      },
    },
    {
      pattern: /^appointmentTypes\[\]\.requiredFields\[\]$/,
      row: {
        classification: "CURRENT_VISIBLE_STILL_BROKEN",
        evidence: "Per-service required intake keys not fully gated on book_appointment",
      },
    },
    {
      pattern: /^appointmentTypes\[\]\.(status|location|modality|description|bookingHours)$/,
      row: {
        classification: "UI_METADATA_ONLY",
        evidence: "Editor metadata / display — not deterministic FIND/BOOK gates today",
      },
    },
  ];
}

const UNCLASSIFIED_EVIDENCE =
  "No launch classification rule — treat as gap until proven";

export function classifyWizardRuntimeLeaf(statePath: string): WizardV3LaunchClassificationRow {
  const exact = EXACT[statePath];
  if (exact) {
    return { statePath, ...exact };
  }
  for (const { pattern, row } of patternRules()) {
    if (pattern.test(statePath)) {
      return { statePath, ...row };
    }
  }
  return {
    statePath,
    classification: "CURRENT_VISIBLE_STILL_BROKEN",
    evidence: UNCLASSIFIED_EVIDENCE,
  };
}

/** Merge explicit launch rules with corrected manifest execution status. */
export function resolveLaunchClassification(
  statePath: string,
  manifestExecutionStatus: string,
): WizardV3LaunchClassificationRow {
  const explicit = classifyWizardRuntimeLeaf(statePath);
  if (explicit.evidence !== UNCLASSIFIED_EVIDENCE) {
    return explicit;
  }
  switch (manifestExecutionStatus) {
    case "ACTIVE_EXECUTION":
    case "LIVE_PROMPT_CONTROL":
      return {
        statePath,
        classification: "CURRENT_VISIBLE_IMPLEMENTED",
        evidence: `Manifest ${manifestExecutionStatus} (runtime consumer documented in worksheet)`,
      };
    case "ACTIVE_CONTROL_PLANE":
    case "CONTROL_PLANE_ONLY":
      return {
        statePath,
        classification: "CONTROL_PLANE_ACTIVE",
        evidence: `Manifest ${manifestExecutionStatus}`,
      };
    case "OUT_OF_SCOPE_RETIRED":
      return {
        statePath,
        classification: "OUT_OF_SCOPE_RETIRED",
        evidence: `Manifest ${manifestExecutionStatus}`,
      };
    case "UI_METADATA_ONLY":
      return {
        statePath,
        classification: "UI_METADATA_ONLY",
        evidence: `Manifest ${manifestExecutionStatus}`,
      };
    case "HIDDEN_STATE_ONLY":
      return {
        statePath,
        classification: "HIDDEN_STATE_ONLY",
        evidence: `Manifest ${manifestExecutionStatus}`,
      };
    case "MCTB_ONLY":
      return {
        statePath,
        classification: "MCTB_ONLY",
        evidence: `Manifest ${manifestExecutionStatus}`,
      };
    case "LEGACY_OBSOLETE":
      return {
        statePath,
        classification: "LEGACY_OBSOLETE",
        evidence: `Manifest ${manifestExecutionStatus}`,
      };
    case "CONFIGURED_NOT_IMPLEMENTED":
      return {
        statePath,
        classification: "CURRENT_VISIBLE_STILL_BROKEN",
        evidence: "Manifest CONFIGURED_NOT_IMPLEMENTED — exposed launch gap",
      };
    default:
      return explicit;
  }
}

export function summarizeLaunchClassifications(
  statePaths: string[],
): Record<WizardV3LaunchClassification, number> & {
  visibleUnimplemented: number;
} {
  const totals: Record<WizardV3LaunchClassification, number> = {
    CURRENT_VISIBLE_IMPLEMENTED: 0,
    CURRENT_VISIBLE_STILL_BROKEN: 0,
    CHILD_IMPLEMENTED_BY_PARENT: 0,
    CONTROL_PLANE_ACTIVE: 0,
    HIDDEN_STATE_ONLY: 0,
    OUT_OF_SCOPE_RETIRED: 0,
    MCTB_ONLY: 0,
    LEGACY_OBSOLETE: 0,
    UI_METADATA_ONLY: 0,
  };
  for (const p of statePaths) {
    totals[classifyWizardRuntimeLeaf(p).classification] += 1;
  }
  return {
    ...totals,
    visibleUnimplemented: totals.CURRENT_VISIBLE_STILL_BROKEN,
  };
}
