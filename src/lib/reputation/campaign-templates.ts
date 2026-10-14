/**
 * Built-in Review Campaign Template Library (immutable system presets).
 * Selecting a template copies it into an org-owned campaign draft — never mutates these defs.
 */

import type { SequenceStep } from "@/lib/reputation/sequence-engine";

export type CampaignTemplateChannel = "sms" | "email" | "both";

export type CampaignTemplateFilter =
  | "sms"
  | "email"
  | "multi-channel"
  | "automatic"
  | "manual-csv"
  | "service-business"
  | "appointment-business"
  | "past-customer-reactivation";

/** How the campaign treats “success” for stopping reminders. */
export type CampaignSuccessMode =
  /** Stop after review-link click (default — click ≈ acted). */
  | "click"
  /** Stop only on opt-out, reply, matched review, or manual completion. */
  | "conservative"
  /** Continue after click until a review is matched. */
  | "continue_until_confirmed";

export type CampaignTemplateMessage = {
  step_key: string;
  channel: "sms" | "email";
  subject?: string;
  body: string;
};

export type CampaignTemplateDefinition = {
  id: string;
  version: string;
  name: string;
  description: string;
  featured?: boolean;
  recommendedIndustries: string[];
  recommendedTrigger: string;
  filters: CampaignTemplateFilter[];
  channel: CampaignTemplateChannel;
  /** Quiet hours / send window defaults */
  sendWindowStart: string;
  sendWindowEnd: string;
  sendDays: number[];
  timezoneHint: string;
  dailySendLimit: number;
  /** Recent-request cooldown (days). Default 60. */
  duplicateProtectionDays: number;
  successMode: CampaignSuccessMode;
  objective: "request_review" | "reactivation";
  suitableForWebhook: boolean;
  suitableForCsvReactivation: boolean;
  requiredConsentChannels: Array<"sms" | "email">;
  complianceNotes: string;
  timeline: string[];
  /** Human-readable total duration estimate */
  totalDurationLabel: string;
  stepCount: number;
  sequence: SequenceStep[];
  messages: CampaignTemplateMessage[];
  requiredVariables: string[];
  createdAt: string;
};

function eligibilityGate(thenKey: string, elseKey = "end"): SequenceStep {
  return {
    step_key: `${thenKey}_gate`,
    step_type: "condition",
    config: {
      // no_activity includes !clicked — default success mode treats click as acted.
      all: ["no_activity", "customer_opted_out:false"],
      then: thenKey,
      else: elseKey,
    },
  };
}

function eligibilityGateUntilReview(thenKey: string, elseKey = "end"): SequenceStep {
  return {
    step_key: `${thenKey}_gate`,
    step_type: "condition",
    config: {
      all: ["customer_opted_out:false", "review_detected:false", "customer_replied:false"],
      then: thenKey,
      else: elseKey,
    },
  };
}

function sendSms(step_key: string, body: string, extra: Record<string, unknown> = {}): SequenceStep {
  return {
    step_key,
    step_type: "send_sms",
    config: {
      force_step_channel: true,
      channels: ["sms"],
      body,
      ...extra,
    },
  };
}

function sendEmail(
  step_key: string,
  subject: string,
  body: string,
  extra: Record<string, unknown> = {}
): SequenceStep {
  return {
    step_key,
    step_type: "send_email",
    config: {
      force_step_channel: true,
      channels: ["email"],
      subject,
      body,
      ...extra,
    },
  };
}

const VARS = [
  "first_name",
  "last_name",
  "business_name",
  "review_link",
  "review_button",
  "service_name",
  "appointment_date",
  "location_name",
  "sender_name",
  "unsubscribe_link",
] as const;

const SMS_QUICK_1 =
  "Hi {{first_name}}, thanks for choosing {{business_name}}. Would you mind sharing your experience? It only takes a moment: {{review_link}}\nReply STOP to opt out.";
const SMS_QUICK_2 =
  "Hi {{first_name}}, just a quick reminder in case you missed our earlier message. We’d really appreciate your honest feedback: {{review_link}}\nReply STOP to opt out.";

const SMS_PLUS_1 =
  "Hi {{first_name}}, thank you for choosing {{business_name}}. We’d appreciate an honest review of your experience: {{review_link}}\nReply STOP to opt out.";

const EMAIL_PLUS_1_SUB = "How did we do, {{first_name}}?";
const EMAIL_PLUS_1 = `Hi {{first_name}},

Thank you for choosing {{business_name}}. We hope everything went well.

Would you take a moment to share your honest experience? Your feedback helps us improve and helps other customers know what to expect.

{{review_button}}

Thank you,
{{business_name}}

{{unsubscribe_link}}`;

const EMAIL_PLUS_2_SUB = "Just a quick reminder";
const EMAIL_PLUS_2 = `Hi {{first_name}},

Just following up in case you didn’t get a chance to share your experience. We’d still appreciate your feedback whenever you have a moment.

{{review_button}}

Thank you again for choosing {{business_name}}.

{{unsubscribe_link}}`;

const EMAIL_PLUS_3_SUB = "One last request for your feedback";
const EMAIL_PLUS_3 = `Hi {{first_name}},

This is our final reminder. Your honest feedback would mean a lot to our team and helps us continue improving.

{{review_button}}

Thank you for your time,
{{business_name}}

{{unsubscribe_link}}`;

const EMAIL_GENTLE_1_SUB = "How was your experience with {{business_name}}?";
const EMAIL_GENTLE_1 = `Hi {{first_name}},

Thank you for trusting {{business_name}}. We’d appreciate it if you shared your honest experience.

{{review_button}}

Your feedback helps us improve and helps future customers make informed decisions.

Thank you,
{{business_name}}

{{unsubscribe_link}}`;

const EMAIL_GENTLE_2_SUB = "Did you get a chance to share your feedback?";
const EMAIL_GENTLE_2 = `Hi {{first_name}},

We know things get busy, so we wanted to send a quick reminder. If you have a moment, we’d appreciate your honest feedback.

{{review_button}}

Thank you,
{{business_name}}

{{unsubscribe_link}}`;

const EMAIL_GENTLE_3_SUB = "Final reminder from {{business_name}}";
const EMAIL_GENTLE_3 = `Hi {{first_name}},

This will be our last reminder. If you have a moment, we’d still value your feedback about your recent experience.

{{review_button}}

Thank you again,
{{business_name}}

{{unsubscribe_link}}`;

const SMS_ONE =
  "Hi {{first_name}}, thank you for choosing {{business_name}}. If you have a moment, we’d value your honest feedback: {{review_link}}\nReply STOP to opt out.";
const EMAIL_ONE_SUB = "Thank you from {{business_name}}";
const EMAIL_ONE = `Hi {{first_name}},

Thank you for choosing us. If you have a moment, we’d appreciate your honest feedback about your experience.

{{review_button}}

{{unsubscribe_link}}`;

const DELAYED_1 =
  "Hi {{first_name}}, we wanted to check in now that you’ve had a little time since your service with {{business_name}}. Would you mind sharing your honest experience? {{review_link}}\nReply STOP to opt out.";
const DELAYED_2 =
  "Hi {{first_name}}, just following up in case you didn’t get a chance to leave feedback. We’d appreciate hearing about your experience: {{review_link}}\nReply STOP to opt out.";

const REACT_1_SUB = "We’d value your feedback";
const REACT_1 = `Hi {{first_name}},

Thank you for previously choosing {{business_name}}. We’re reaching out because your experience matters to us.

If you’re willing, would you take a moment to leave an honest review?

{{review_button}}

Thank you,
{{business_name}}

{{unsubscribe_link}}`;

const REACT_SMS =
  "Hi {{first_name}}, this is {{business_name}}. We recently sent a request for feedback and wanted to share the link here as well: {{review_link}}\nReply STOP to opt out.";

const REACT_3_SUB = "One final request for your feedback";
const REACT_3 = `Hi {{first_name}},

This will be our final reminder. If you have a moment, we’d appreciate your honest feedback about your experience with {{business_name}}.

{{review_button}}

{{unsubscribe_link}}`;

function messagesFromSequence(sequence: SequenceStep[]): CampaignTemplateMessage[] {
  const out: CampaignTemplateMessage[] = [];
  for (const step of sequence) {
    if (step.step_type !== "send_sms" && step.step_type !== "send_email") continue;

    const smsBody = String(step.config.body ?? "");
    const emailAlt = String(step.config.email_body ?? "");
    const subject = String(step.config.subject ?? "");

    if (step.step_type === "send_email") {
      out.push({
        step_key: step.step_key,
        channel: "email",
        subject: subject || undefined,
        body: smsBody,
      });
      continue;
    }

    // send_sms — may also carry email_body for prefer_single fallbacks
    if (smsBody) {
      out.push({ step_key: step.step_key, channel: "sms", body: smsBody });
    }
    if (emailAlt) {
      out.push({
        step_key: step.step_key,
        channel: "email",
        subject: subject || undefined,
        body: emailAlt,
      });
    }
  }
  return out;
}

/** Rewrite eligibility gates for a chosen success mode (does not mutate input). */
export function applySuccessModeToSequence(
  sequence: SequenceStep[],
  mode: CampaignSuccessMode
): SequenceStep[] {
  if (mode === "click") return structuredClone(sequence) as SequenceStep[];
  return sequence.map((step) => {
    if (step.step_type !== "condition") return { ...step, config: { ...step.config } };
    const thenKey = String(step.config.then ?? "end");
    const elseKey = String(step.config.else ?? "end");
    if (mode === "continue_until_confirmed") {
      return {
        ...step,
        config: {
          all: ["customer_opted_out:false", "review_detected:false", "customer_replied:false"],
          then: thenKey,
          else: elseKey,
        },
      };
    }
    // conservative: ignore click; stop on reply / opt-out / matched review only
    return {
      ...step,
      config: {
        all: ["customer_opted_out:false", "review_detected:false", "customer_replied:false"],
        then: thenKey,
        else: elseKey,
      },
    };
  });
}

const TEMPLATE_SMS_FIRST: CampaignTemplateDefinition = {
  id: "sms-first-quick-request",
  version: "1.0.0",
  name: "SMS-First Quick Request",
  description:
    "Post-service SMS after two hours, one reminder after three days. Best default for home-service businesses with SMS consent.",
  recommendedIndustries: [
    "Junk removal",
    "Plumbing",
    "HVAC",
    "Roofing",
    "Cleaning",
    "Auto services",
    "Salons",
  ],
  recommendedTrigger: "Service / appointment completed",
  filters: ["sms", "automatic", "service-business", "appointment-business"],
  channel: "sms",
  sendWindowStart: "09:00",
  sendWindowEnd: "19:00",
  sendDays: [1, 2, 3, 4, 5, 6, 0],
  timezoneHint: "America/New_York",
  dailySendLimit: 25,
  duplicateProtectionDays: 60,
  successMode: "click",
  objective: "request_review",
  suitableForWebhook: true,
  suitableForCsvReactivation: false,
  requiredConsentChannels: ["sms"],
  complianceNotes:
    "Requests honest feedback only. Same review link for every eligible recipient. Includes STOP language.",
  timeline: ["Job completed", "Wait 2h", "SMS", "Wait 3d", "Reminder SMS", "End"],
  totalDurationLabel: "~3 days",
  stepCount: 2,
  sequence: [
    { step_key: "delay_2h", step_type: "wait", config: { hours: 2, allow_short: true, role: "initial_delay" } },
    sendSms("initial", SMS_QUICK_1),
    { step_key: "wait_3d", step_type: "wait", config: { days: 3 } },
    eligibilityGate("reminder_1"),
    sendSms("reminder_1", SMS_QUICK_2, { template: "reminder" }),
    { step_key: "end", step_type: "end", config: {} },
  ],
  messages: [],
  requiredVariables: [...VARS],
  createdAt: "2026-07-16T00:00:00.000Z",
};

const TEMPLATE_SMS_EMAIL: CampaignTemplateDefinition = {
  id: "sms-email-follow-up",
  version: "1.0.0",
  name: "SMS + Email Follow-Up",
  description:
    "Featured multi-channel sequence: SMS first, then three gentle emails over about a week. Strongest general-purpose default.",
  featured: true,
  recommendedIndustries: ["Most local service businesses"],
  recommendedTrigger: "Service completed, invoice paid, or webhook enrollment",
  filters: ["sms", "email", "multi-channel", "automatic", "service-business", "appointment-business"],
  channel: "both",
  sendWindowStart: "09:00",
  sendWindowEnd: "19:00",
  sendDays: [1, 2, 3, 4, 5],
  timezoneHint: "America/New_York",
  dailySendLimit: 20,
  duplicateProtectionDays: 60,
  successMode: "click",
  objective: "request_review",
  suitableForWebhook: true,
  suitableForCsvReactivation: false,
  requiredConsentChannels: ["sms", "email"],
  complianceNotes:
    "Honest-feedback only. Click on the review link stops further reminders by default (assumption, not confirmed attribution).",
  timeline: [
    "Job completed",
    "Wait 2h",
    "SMS",
    "Wait 1d",
    "Email",
    "Wait 3d",
    "Email reminder",
    "Wait 3d",
    "Final email",
    "End",
  ],
  totalDurationLabel: "~1 week",
  stepCount: 4,
  sequence: [
    { step_key: "delay_2h", step_type: "wait", config: { hours: 2, allow_short: true, role: "initial_delay" } },
    sendSms("initial_sms", SMS_PLUS_1),
    { step_key: "wait_1d", step_type: "wait", config: { days: 1 } },
    eligibilityGate("email_1"),
    sendEmail("email_1", EMAIL_PLUS_1_SUB, EMAIL_PLUS_1),
    { step_key: "wait_3d_a", step_type: "wait", config: { days: 3 } },
    eligibilityGate("email_2"),
    sendEmail("email_2", EMAIL_PLUS_2_SUB, EMAIL_PLUS_2, { template: "reminder" }),
    { step_key: "wait_3d_b", step_type: "wait", config: { days: 3 } },
    eligibilityGate("email_3"),
    sendEmail("email_3", EMAIL_PLUS_3_SUB, EMAIL_PLUS_3, { template: "final" }),
    { step_key: "end", step_type: "end", config: {} },
  ],
  messages: [],
  requiredVariables: [...VARS],
  createdAt: "2026-07-16T00:00:00.000Z",
};

const TEMPLATE_EMAIL_ONLY: CampaignTemplateDefinition = {
  id: "email-only-gentle",
  version: "1.0.0",
  name: "Email-Only Gentle Sequence",
  description:
    "Three emails over roughly one week. Default when SMS consent or SMS allowance is unavailable.",
  recommendedIndustries: ["Professional services", "Businesses without SMS"],
  recommendedTrigger: "Enrollment or service completion",
  filters: ["email", "automatic", "manual-csv", "service-business", "appointment-business"],
  channel: "email",
  sendWindowStart: "09:00",
  sendWindowEnd: "19:00",
  sendDays: [1, 2, 3, 4, 5],
  timezoneHint: "America/New_York",
  dailySendLimit: 30,
  duplicateProtectionDays: 60,
  successMode: "click",
  objective: "request_review",
  suitableForWebhook: true,
  suitableForCsvReactivation: true,
  requiredConsentChannels: ["email"],
  complianceNotes: "Email-only; always includes unsubscribe. No review gating.",
  timeline: ["Enrolled", "Wait 3h", "Email", "Wait 3d", "Reminder", "Wait 4d", "Final", "End"],
  totalDurationLabel: "~1 week",
  stepCount: 3,
  sequence: [
    { step_key: "delay_3h", step_type: "wait", config: { hours: 3, allow_short: true, role: "initial_delay" } },
    sendEmail("initial", EMAIL_GENTLE_1_SUB, EMAIL_GENTLE_1),
    { step_key: "wait_3d", step_type: "wait", config: { days: 3 } },
    eligibilityGate("reminder_1"),
    sendEmail("reminder_1", EMAIL_GENTLE_2_SUB, EMAIL_GENTLE_2, { template: "reminder" }),
    { step_key: "wait_4d", step_type: "wait", config: { days: 4 } },
    eligibilityGate("reminder_2"),
    sendEmail("reminder_2", EMAIL_GENTLE_3_SUB, EMAIL_GENTLE_3, { template: "final" }),
    { step_key: "end", step_type: "end", config: {} },
  ],
  messages: [],
  requiredVariables: [...VARS],
  createdAt: "2026-07-16T00:00:00.000Z",
};

const TEMPLATE_ONE_TOUCH: CampaignTemplateDefinition = {
  id: "one-touch-minimal",
  version: "1.0.0",
  name: "One-Touch Minimal Request",
  description:
    "A single low-pressure request after four hours — SMS when possible, otherwise email. No reminders.",
  recommendedIndustries: ["Medical", "Legal", "Luxury", "High-trust professional services"],
  recommendedTrigger: "Service completed",
  filters: ["sms", "email", "multi-channel", "automatic", "service-business"],
  channel: "both",
  sendWindowStart: "09:00",
  sendWindowEnd: "19:00",
  sendDays: [1, 2, 3, 4, 5],
  timezoneHint: "America/New_York",
  dailySendLimit: 40,
  duplicateProtectionDays: 60,
  successMode: "click",
  objective: "request_review",
  suitableForWebhook: true,
  suitableForCsvReactivation: false,
  requiredConsentChannels: ["sms", "email"],
  complianceNotes: "One message only. Prefers SMS when the contact has a valid phone; otherwise email.",
  timeline: ["Job completed", "Wait 4h", "SMS or Email", "End"],
  totalDurationLabel: "Same day",
  stepCount: 1,
  sequence: [
    { step_key: "delay_4h", step_type: "wait", config: { hours: 4, allow_short: true, role: "initial_delay" } },
    {
      step_key: "initial",
      step_type: "send_sms",
      config: {
        prefer_single: "sms",
        channels: ["sms", "email"],
        body: SMS_ONE,
        subject: EMAIL_ONE_SUB,
        email_body: EMAIL_ONE,
      },
    },
    { step_key: "end", step_type: "end", config: {} },
  ],
  messages: [
    { step_key: "initial", channel: "sms", body: SMS_ONE },
    { step_key: "initial", channel: "email", subject: EMAIL_ONE_SUB, body: EMAIL_ONE },
  ],
  requiredVariables: [...VARS],
  createdAt: "2026-07-16T00:00:00.000Z",
};

const TEMPLATE_DELAYED: CampaignTemplateDefinition = {
  id: "delayed-post-completion",
  version: "1.0.0",
  name: "Delayed Post-Completion",
  description:
    "Waits two days so the customer can experience the outcome, then one reminder four days later.",
  recommendedIndustries: ["Remodeling", "Roofing", "Legal", "Medical", "Home delivery", "Repairs"],
  recommendedTrigger: "Project completed, order fulfilled, or invoice paid",
  filters: ["sms", "email", "multi-channel", "automatic", "service-business"],
  channel: "both",
  sendWindowStart: "09:00",
  sendWindowEnd: "19:00",
  sendDays: [1, 2, 3, 4, 5],
  timezoneHint: "America/New_York",
  dailySendLimit: 20,
  duplicateProtectionDays: 60,
  successMode: "click",
  objective: "request_review",
  suitableForWebhook: true,
  suitableForCsvReactivation: false,
  requiredConsentChannels: ["sms", "email"],
  complianceNotes: "Initial delay is editable after copy (1–7 days). Honest feedback only.",
  timeline: ["Completed", "Wait 2d", "Request", "Wait 4d", "Reminder", "End"],
  totalDurationLabel: "~6 days",
  stepCount: 2,
  sequence: [
    { step_key: "delay_2d", step_type: "wait", config: { days: 2, role: "initial_delay" } },
    {
      step_key: "initial",
      step_type: "send_sms",
      config: {
        prefer_single: "sms",
        channels: ["sms", "email"],
        body: DELAYED_1,
        subject: "Checking in from {{business_name}}",
        email_body: `Hi {{first_name}},\n\nWe wanted to check in now that you’ve had a little time since your service with {{business_name}}. Would you mind sharing your honest experience?\n\n{{review_button}}\n\n{{unsubscribe_link}}`,
      },
    },
    { step_key: "wait_4d", step_type: "wait", config: { days: 4 } },
    eligibilityGate("reminder_1"),
    {
      step_key: "reminder_1",
      step_type: "send_sms",
      config: {
        prefer_single: "sms",
        channels: ["sms", "email"],
        template: "reminder",
        body: DELAYED_2,
        subject: "Quick reminder from {{business_name}}",
        email_body: `Hi {{first_name}},\n\nJust following up in case you didn’t get a chance to leave feedback. We’d appreciate hearing about your experience.\n\n{{review_button}}\n\n{{unsubscribe_link}}`,
      },
    },
    { step_key: "end", step_type: "end", config: {} },
  ],
  messages: [],
  requiredVariables: [...VARS],
  createdAt: "2026-07-16T00:00:00.000Z",
};

const TEMPLATE_REACTIVATION: CampaignTemplateDefinition = {
  id: "past-customer-reactivation",
  version: "1.0.0",
  name: "Past-Customer Review Reactivation",
  description:
    "For CSV / manual lists of past customers. Email first, optional SMS, then a final email. Stronger consent warnings apply.",
  recommendedIndustries: ["New accounts", "Businesses that never asked past customers"],
  recommendedTrigger: "Manual selection or CSV import only",
  filters: ["email", "sms", "multi-channel", "manual-csv", "past-customer-reactivation"],
  channel: "both",
  sendWindowStart: "09:00",
  sendWindowEnd: "19:00",
  sendDays: [1, 2, 3, 4, 5],
  timezoneHint: "America/New_York",
  dailySendLimit: 15,
  duplicateProtectionDays: 90,
  successMode: "click",
  objective: "reactivation",
  suitableForWebhook: false,
  suitableForCsvReactivation: true,
  requiredConsentChannels: ["email"],
  complianceNotes:
    "Do not auto-enroll historical contacts without consent checks. Respect suppressions, contact age, and batch pacing. 90-day cooldown default.",
  timeline: ["CSV / manual", "Email", "Wait 3d", "SMS (if consent)", "Wait 4d", "Final email", "End"],
  totalDurationLabel: "~1 week",
  stepCount: 3,
  sequence: [
    sendEmail("initial", REACT_1_SUB, REACT_1),
    { step_key: "wait_3d", step_type: "wait", config: { days: 3 } },
    eligibilityGate("sms_1"),
    sendSms("sms_1", REACT_SMS),
    { step_key: "wait_4d", step_type: "wait", config: { days: 4 } },
    eligibilityGate("email_final"),
    sendEmail("email_final", REACT_3_SUB, REACT_3, { template: "final" }),
    { step_key: "end", step_type: "end", config: {} },
  ],
  messages: [],
  requiredVariables: [...VARS],
  createdAt: "2026-07-16T00:00:00.000Z",
};

function finalize(def: CampaignTemplateDefinition): CampaignTemplateDefinition {
  const messages = def.messages.length ? def.messages : messagesFromSequence(def.sequence);
  const stepCount = def.sequence.filter(
    (s) => s.step_type === "send_sms" || s.step_type === "send_email"
  ).length;
  return { ...def, messages, stepCount };
}

/** Immutable system catalog — never mutate at runtime. */
export const CAMPAIGN_SYSTEM_TEMPLATES: readonly CampaignTemplateDefinition[] = [
  finalize(TEMPLATE_SMS_EMAIL),
  finalize(TEMPLATE_SMS_FIRST),
  finalize(TEMPLATE_EMAIL_ONLY),
  finalize(TEMPLATE_ONE_TOUCH),
  finalize(TEMPLATE_DELAYED),
  finalize(TEMPLATE_REACTIVATION),
];

export function listCampaignSystemTemplates(filters?: CampaignTemplateFilter[]): CampaignTemplateDefinition[] {
  const all = [...CAMPAIGN_SYSTEM_TEMPLATES];
  if (!filters?.length) return all;
  return all.filter((t) => filters.every((f) => t.filters.includes(f)));
}

export function getCampaignSystemTemplate(id: string): CampaignTemplateDefinition | null {
  return CAMPAIGN_SYSTEM_TEMPLATES.find((t) => t.id === id) ?? null;
}

export function featuredCampaignTemplate(): CampaignTemplateDefinition {
  return (
    CAMPAIGN_SYSTEM_TEMPLATES.find((t) => t.featured) ??
    getCampaignSystemTemplate("sms-email-follow-up")!
  );
}

/** Pick a sensible default template for the business context. */
export function recommendCampaignTemplate(params: {
  hasSmsConsentCapability?: boolean;
  isHomeService?: boolean;
}): CampaignTemplateDefinition {
  if (params.hasSmsConsentCapability === false) {
    return getCampaignSystemTemplate("email-only-gentle")!;
  }
  if (params.isHomeService) {
    return getCampaignSystemTemplate("sms-first-quick-request")!;
  }
  return featuredCampaignTemplate();
}

/**
 * Deep-copy a system template into editable campaign fields.
 * Built-ins stay immutable; callers own the returned objects.
 */
export function materializeCampaignTemplate(templateId: string): {
  template: CampaignTemplateDefinition;
  sequence: SequenceStep[];
  channel: CampaignTemplateChannel;
  name: string;
  description: string;
  dailySendLimit: number;
  sendDays: number[];
  sendWindowStart: string;
  sendWindowEnd: string;
  duplicateProtectionDays: number;
  successMode: CampaignSuccessMode;
  objective: "request_review" | "reactivation";
  sourceTemplateId: string;
  sourceTemplateVersion: string;
} | null {
  const template = getCampaignSystemTemplate(templateId);
  if (!template) return null;
  return {
    template,
    sequence: applySuccessModeToSequence(template.sequence, template.successMode),
    channel: template.channel,
    name: template.name,
    description: template.description,
    dailySendLimit: template.dailySendLimit,
    sendDays: [...template.sendDays],
    sendWindowStart: template.sendWindowStart,
    sendWindowEnd: template.sendWindowEnd,
    duplicateProtectionDays: template.duplicateProtectionDays,
    successMode: template.successMode,
    objective: template.objective,
    sourceTemplateId: template.id,
    sourceTemplateVersion: template.version,
  };
}

/** Gate helper used by continue_until_confirmed mode (exported for tests). */
export function buildContinueUntilConfirmedGate(thenKey: string): SequenceStep {
  return eligibilityGateUntilReview(thenKey);
}
