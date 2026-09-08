/**
 * Classification for every browser-cert flow.
 *
 * Tiers:
 * - TRUE_USER_ACTION — click/type/submit/wait/reload/verify persistence (full acceptance standard)
 * - ROUTE_RENDER — reachability, shell, redirect, control-exists, light nav (not sufficient alone for customer-operable features)
 * - BACKEND_STATIC — no browser; backend/script certification only
 */
export type FlowClassification = "TRUE_USER_ACTION" | "ROUTE_RENDER" | "BACKEND_STATIC";

export type FlowClassificationMeta = {
  classification: FlowClassification;
  /** Customer can operate this feature from the frontend */
  customerOperable: boolean;
  /** Needs a companion TRUE_USER_ACTION flow if classification is not TRUE_USER_ACTION */
  needsUserActionFlow: boolean;
  /** Companion UA flow id when planned */
  userActionFlowId?: string;
  notes?: string;
};

/** Explicit classification for all reachability/static flows (189 baseline). */
export const FLOW_CLASSIFICATION: Record<string, FlowClassificationMeta> = {
  // BATCH-01 — Appointments nav + Home
  "APT-01": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Shell smoke" },
  "APT-01-home": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "APT-01-calendar": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-03-calendar" },
  "APT-01-list": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-04-list" },
  "APT-01-waitlist": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-22-waitlist" },
  "APT-01-recalls": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-types": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-11-types" },
  "APT-01-booking-pages": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-12-booking-pages" },
  "APT-01-availability": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-16-availability" },
  "APT-01-ai-booking": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-routing-forms": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-20-routing-forms" },
  "APT-01-polls": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-contacts": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-conversations": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-reminders": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-33-reminders" },
  "APT-01-workflows": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-wf-templates": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-wf-activity": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-meetings": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-video": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-analytics": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "APT-01-analytics-booking": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "APT-01-analytics-reminders": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "APT-01-analytics-automations": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "APT-01-analytics-reports": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "APT-01-integrations": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-settings": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-01-getting-started": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "APT-01-mobile-nav": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Viewport only" },
  "APT-01-browser-back": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Back nav context" },
  "APT-02": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },

  // BATCH-02
  "APT-03": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-03-calendar", notes: "Today/Next clicks only — no persistence" },
  "APT-04": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-04-list", notes: "Search fill only — no filter persist" },
  "APT-05": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-05-create", notes: "Form visible — does not create" },

  // BATCH-03
  "APT-11": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-11-types" },
  "APT-16": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-16-availability" },
  "APT-17": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-17-staff" },
  "APT-18": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-18-locations" },
  "APT-26": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-27": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-11-save-reload": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-11-types", notes: "Focus save + reload — no actual save" },

  // BATCH-04
  "APT-12": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-12-booking-pages" },
  "APT-13-invalid-slug": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Public error state" },
  "APT-13-full-flow": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-13-public-book" },

  // BATCH-05
  "APT-33": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-33-reminders" },
  "APT-35": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-36": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-37": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-34": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "BLOCKED — LIVE PSTN" },
  "APT-34-ui": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: false, notes: "Load-only; PSTN blocked" },

  // BATCH-06
  "APT-40": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-41": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-42": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-43": { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false },
  "APT-44": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-38": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-39": { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false },
  "APT-45": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "BLOCKED — LIVE PSTN" },

  // BATCH-07
  "APT-57": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-46": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-50": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-50-notetaker" },
  "APT-48": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "BLOCKED — LIVE MEDIA" },
  "APT-49": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-49-guest-join" },
  "APT-49-invalid-token": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "APT-55": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "BLOCKED — LIVE EXTERNAL PROVIDER" },
  "APT-58": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-61": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "NOT IMPLEMENTED" },
  "APT-51": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-11-types" },
  "APT-52": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-52-notetaker-appt" },
  "APT-53": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-54": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-50-notetaker" },
  "APT-56": { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false },
  "APT-59": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-59-recap" },
  "APT-59-invalid": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "APT-60": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-50-notetaker" },
  "APT-47": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-05-create" },

  // BATCH-08 — MCTB nav
  "MCTB-01": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Product shell switch" },
  "MCTB-01-home": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "MCTB-01-missed-calls": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-28-missed-calls" },
  "MCTB-01-conversations": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-30-conversations" },
  "MCTB-01-voicemail": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-51-voicemail" },
  "MCTB-01-analytics": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "MCTB-01-setup": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-04-setup" },
  "MCTB-01-numbers": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "MCTB-02": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },

  // BATCH-09
  "MCTB-28": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-28-missed-calls", notes: "List/table presence only" },
  "MCTB-30": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-30-conversations", notes: "Inbox body text only" },
  "MCTB-29": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-29-detail" },

  // BATCH-10 — MCTB setup
  "MCTB-04": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-04-setup" },
  "MCTB-05": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-05-phone" },
  "MCTB-06": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-06-rules" },
  "MCTB-07": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-07-consent" },
  "MCTB-09": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-07-consent" },
  "MCTB-12": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-12-textback" },
  "MCTB-13": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-13-links" },
  "MCTB-19": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-19-recovery" },
  "MCTB-22": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-22-exclusions" },
  "MCTB-49": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-49-voicemail-setup" },
  "MCTB-54": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-54-test" },
  "MCTB-03": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-03-wizard" },
  "MCTB-05-live-verify": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "BLOCKED — LIVE PSTN" },
  "MCTB-08": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "Press-1 runtime — backend certified" },
  "MCTB-10": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "Existing consent runtime — backend certified" },
  "MCTB-11": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-11-consent-log" },
  "MCTB-11-ui": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-11-consent-log" },
  "MCTB-20": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Legacy redirect" },

  // BATCH-11
  "MCTB-41": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-41-notifications" },
  "MCTB-23": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-41-notifications" },
  "MCTB-24": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-41-notifications" },
  "MCTB-25": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-41-notifications" },
  "MCTB-26": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-41-notifications" },
  "MCTB-27": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-41-notifications" },
  "MCTB-31": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-32": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-33": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-34": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-35": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-36": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-37": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-38": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-39": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-40": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-42": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-43": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-44": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-45": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-46": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-47": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-48": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-14": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-14-public-form" },
  "MCTB-14-invalid": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "MCTB-17": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "INTENTIONALLY DEFERRED" },
  "MCTB-18": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "INTENTIONALLY DEFERRED" },
  "MCTB-21": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "INTENTIONALLY DEFERRED" },

  // BATCH-12
  "MCTB-51": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-51-voicemail" },
  "MCTB-56": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false },
  "MCTB-52": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-51-voicemail" },
  "MCTB-50": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-49-voicemail-setup" },
  "MCTB-53": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-55": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-MCTB-54-test" },
  "MCTB-15": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-16": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "MCTB-57-voice-missed": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Legacy redirect" },
  "MCTB-57-voice-setup": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Legacy redirect" },
  "MCTB-57-voice-analytics": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Legacy redirect" },
  "MCTB-57-voice-conversations": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Legacy redirect" },
  "MCTB-57-schedule": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Legacy redirect" },
  "MCTB-57-business-hours": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Legacy redirect" },
  "MCTB-57-follow-up": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Legacy redirect" },
  "MCTB-58": { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false },

  // BATCH-13
  "CROSS-01-appointments": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Product shell" },
  "CROSS-01-mctb": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Product shell" },
  "CROSS-01-back": { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Product shell" },
  "CROSS-02": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-CROSS-02-mctb-booking" },
  "CROSS-03": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "CROSS-04": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "CROSS-05": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "CROSS-06": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "CROSS-07": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "CROSS-08": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },

  // BATCH-14
  "APT-06": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-06-detail" },
  "APT-07": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-07-edit" },
  "APT-08": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-08-reschedule" },
  "APT-09": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-09-cancel" },
  "APT-10": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-10-status" },
  "APT-14": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-15": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-19": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: false, notes: "BLOCKED — LIVE EXTERNAL PROVIDER" },
  "APT-20": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-20-routing-forms" },
  "APT-21": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-22": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true, userActionFlowId: "UA-APT-22-waitlist" },
  "APT-23": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-24": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-25": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-28": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-29": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-30": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-31": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-32": { classification: "BACKEND_STATIC", customerOperable: true, needsUserActionFlow: true },
  "APT-62": { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false },
  "APT-63": { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false },
  "APT-64": { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false },
  "APT-65": { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false },
  "APT-66": { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false },
  "APT-67": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-68": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-69-business": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-69-messaging": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
  "APT-69-calendar": { classification: "ROUTE_RENDER", customerOperable: true, needsUserActionFlow: true },
};

export function classifyFlow(id: string, hasStatic: boolean): FlowClassificationMeta {
  if (FLOW_CLASSIFICATION[id]) return FLOW_CLASSIFICATION[id];
  if (hasStatic) {
    return { classification: "BACKEND_STATIC", customerOperable: false, needsUserActionFlow: false, notes: "Unmapped static flow" };
  }
  return { classification: "ROUTE_RENDER", customerOperable: false, needsUserActionFlow: false, notes: "Unmapped browser flow — default route/render" };
}
