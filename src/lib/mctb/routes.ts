/** Canonical MCTB customer-facing routes (frontend). APIs remain on existing paths. */
export const MCTB_ROUTES = {
  home: "/mctb",
  missedCalls: "/mctb/missed-calls",
  missedCallDetail: (id: string) => `/mctb/missed-calls/${id}`,
  conversations: "/mctb/conversations",
  /** Full visual voicemail inbox (PersonalVoicemailUI). Legacy `/mctb/voicemail` redirects here. */
  voicemail: "/personal/voicemail",
  analytics: "/mctb/analytics",
  setup: "/mctb/setup",
  setupStart: "/mctb/setup/start",
  setupPhone: "/mctb/setup/phone",
  setupMissedCallRules: "/mctb/setup/missed-call-rules",
  setupTextBack: "/mctb/setup/text-back",
  setupLinks: "/mctb/setup/links",
  setupConsent: "/mctb/setup/consent",
  setupNotifications: "/mctb/setup/notifications",
  setupRecovery: "/mctb/setup/recovery",
  setupVoicemail: "/mctb/setup/voicemail",
  setupExclusions: "/mctb/setup/exclusions",
  setupTest: "/mctb/setup/test",
  numbers: "/mctb/numbers",
  complianceConsent: "/mctb/compliance/consent",
} as const;
