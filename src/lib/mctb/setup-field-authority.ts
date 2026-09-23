/**
 * Authoritative persistence for duplicate MCTB setup surfaces (simplified launch audit).
 * Both surfaces in each pair must POST to /api/mctb/setup with the same field names.
 */

export const MCTB_SETUP_FIELD_AUTHORITY = {
  missedCallRulesVsRecoveryTriggers: {
    surfaces: ["/mctb/setup/missed-call-rules", "/mctb/setup/recovery"],
    fields: ["triggerRules"],
    persistence: "updateMissedCallTextConfig → trigger_rules (MissedCallTextConfig)",
  },
  textBackDelayVsRecoveryDelay: {
    surfaces: ["/mctb/setup/text-back", "/mctb/setup/recovery"],
    fields: ["delaySeconds"],
    persistence: "updateMissedCallTextConfig → delaySeconds",
  },
  linksVsRecoveryDefaultLink: {
    surfaces: ["/mctb/setup/links", "/mctb/setup/recovery (booking section)"],
    fields: ["defaultLinkUrl", "requestFormEnabled", "requestFormFieldsJson"],
    persistence: "updateMissedCallTextConfig → default_link_url, request_form_*",
  },
  recoveryGoal: {
    surfaces: ["/onboarding/mctb", "/mctb/setup/text-back"],
    fields: ["recoveryGoal"],
    persistence:
      "workspace.customFieldsConfig.mctb.recoveryGoal + applyMctbRecoveryGoalConfiguration → initial_message + request_form_fields_json",
  },
} as const;
