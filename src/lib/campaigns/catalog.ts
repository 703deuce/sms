/**
 * Transovo campaign library — ~14 core categories, not hundreds of near-duplicates.
 * Each category is one engine with configurable trigger / delay / message / stop rules.
 */

import type { SequenceStep } from "./sequence-engine";

export type CampaignCategoryId =
  | "broadcast"
  | "follow_up"
  | "welcome"
  | "appointment"
  | "missed_call"
  | "review"
  | "lead_nurture"
  | "win_back"
  | "promotion"
  | "status_update"
  | "payment"
  | "event_rsvp"
  | "data_collection"
  | "custom";

export type CampaignCategory = {
  id: CampaignCategoryId;
  /** Customer-facing card title */
  title: string;
  /** Short supporting line */
  description: string;
  /** Engine under the hood */
  engine: "broadcast" | "sequence" | "automation";
  /** Example use cases shown on the card */
  examples: string[];
  /** Configurable options exposed in the builder */
  options: string[];
  /** Default CTA on card */
  cta: string;
  tone: string;
  icon: string;
};

/** Customer-facing choices for the campaign screen */
export const CAMPAIGN_CATEGORIES: CampaignCategory[] = [
  {
    id: "broadcast",
    title: "Send an Announcement",
    description: "One message to a list — now or scheduled.",
    engine: "broadcast",
    examples: ["promotions", "holiday hours", "emergency notices", "events", "updates"],
    options: ["audience", "message", "send now / schedule", "quiet hours"],
    cta: "Create broadcast",
    tone: "bg-indigo-50 text-indigo-700",
    icon: "Megaphone",
  },
  {
    id: "follow_up",
    title: "Follow Up Automatically",
    description: "Triggered after an event, then delayed messages until they reply or convert.",
    engine: "sequence",
    examples: ["new lead", "estimate sent", "appointment done", "no reply", "job completed"],
    options: ["trigger", "delays", "# of follow-ups", "stop on reply", "stop on booked/paid"],
    cta: "Build follow-up",
    tone: "bg-violet-50 text-violet-700",
    icon: "RefreshCw",
  },
  {
    id: "welcome",
    title: "Welcome New Contacts",
    description: "Onboarding when someone joins as a subscriber, customer, member, or lead.",
    engine: "sequence",
    examples: ["keyword join", "form signup", "new customer", "new member", "employee"],
    options: ["entry trigger", "welcome message", "extra tips", "start another workflow"],
    cta: "Create welcome",
    tone: "bg-violet-50 text-violet-700",
    icon: "Hand",
  },
  {
    id: "appointment",
    title: "Send Appointment Reminders",
    description: "Date-based confirmation, reminders, and no-show follow-up.",
    engine: "sequence",
    examples: ["confirm", "24h reminder", "2h reminder", "reschedule", "no-show"],
    options: ["reminder timing", "confirm/cancel replies", "instructions", "recurring service"],
    cta: "Set reminders",
    tone: "bg-indigo-50 text-indigo-700",
    icon: "CalendarClock",
  },
  {
    id: "missed_call",
    title: "Reply to Missed Calls or Messages",
    description: "Automatic responses for missed calls, after-hours, keywords, and inbound SMS.",
    engine: "automation",
    examples: ["missed-call text-back", "after-hours", "holiday reply", "keyword auto-reply"],
    options: ["trigger", "business hours", "auto reply", "start workflow", "notify staff"],
    cta: "Set auto-reply",
    tone: "bg-amber-50 text-amber-700",
    icon: "PhoneMissed",
  },
  {
    id: "review",
    title: "Request Reviews or Feedback",
    description: "Ask for a review or survey after a job, visit, sale, or delivery.",
    engine: "sequence",
    examples: ["Google review", "rating question", "survey", "testimonial", "private feedback"],
    options: ["trigger", "review link", "reminder", "alert staff on negative"],
    cta: "Request reviews",
    tone: "bg-yellow-50 text-yellow-700",
    icon: "Star",
  },
  {
    id: "lead_nurture",
    title: "Nurture New Leads",
    description: "Multi-step sequence to qualify and convert leads toward booking or buying.",
    engine: "sequence",
    examples: ["send info", "qualify", "booking link", "estimate link", "objection handle"],
    options: ["steps", "booking link", "stop on convert", "alert staff on reply"],
    cta: "Build nurture",
    tone: "bg-indigo-50 text-indigo-700",
    icon: "TrendingUp",
  },
  {
    id: "win_back",
    title: "Bring Back Past Customers",
    description: "Reactivate contacts who have been quiet for a configurable period.",
    engine: "sequence",
    examples: ["we miss you", "book again", "seasonal recall", "expired customer", "abandoned lead"],
    options: ["inactivity period", "offer", "stop on reply/book"],
    cta: "Create win-back",
    tone: "bg-rose-50 text-rose-700",
    icon: "HeartHandshake",
  },
  {
    id: "promotion",
    title: "Promote an Offer",
    description: "Discounts, coupons, flash sales, birthday offers, and referral promos.",
    engine: "broadcast",
    examples: ["% off", "coupon", "flash sale", "birthday", "loyalty", "referral"],
    options: ["audience", "offer copy", "expiry", "follow-up if unused"],
    cta: "Promote offer",
    tone: "bg-orange-50 text-orange-700",
    icon: "Tag",
  },
  {
    id: "status_update",
    title: "Send Status Updates",
    description: "When a job/order/status changes to X, send message Y.",
    engine: "automation",
    examples: ["dispatched", "en route", "completed", "shipped", "ready for pickup"],
    options: ["status trigger", "message", "webhook source", "notify staff"],
    cta: "Configure updates",
    tone: "bg-violet-50 text-violet-700",
    icon: "Truck",
  },
  {
    id: "payment",
    title: "Collect Payments",
    description: "Invoice, due, overdue, deposit, and payment-received reminders.",
    engine: "sequence",
    examples: ["invoice sent", "due soon", "overdue", "payment received", "failed payment"],
    options: ["payment link", "timing", "escalation", "stop when paid"],
    cta: "Set payment texts",
    tone: "bg-lime-50 text-lime-700",
    icon: "CreditCard",
  },
  {
    id: "event_rsvp",
    title: "Manage an Event",
    description: "Invitation, RSVP, reminders, directions, and post-event follow-up.",
    engine: "sequence",
    examples: ["invite", "RSVP", "reminder", "directions", "cancel notice", "survey"],
    options: ["event date", "RSVP collection", "reminders", "post-event"],
    cta: "Plan event texts",
    tone: "bg-fuchsia-50 text-fuchsia-700",
    icon: "PartyPopper",
  },
  {
    id: "data_collection",
    title: "Collect Information",
    description: "Ask questions and save answers to contact fields.",
    engine: "sequence",
    examples: ["preferences", "zip", "service needed", "poll", "survey", "update info"],
    options: ["questions", "field mapping", "confirmation", "branch on answer"],
    cta: "Create survey",
    tone: "bg-indigo-50 text-indigo-700",
    icon: "ClipboardList",
  },
  {
    id: "custom",
    title: "Build a Custom Workflow",
    description: "Blank canvas: trigger → conditions → delay → message → branch → action.",
    engine: "automation",
    examples: ["any trigger", "any delay", "any branch", "webhook actions"],
    options: ["trigger", "conditions", "delays", "messages", "actions"],
    cta: "Open builder",
    tone: "bg-slate-100 text-slate-700",
    icon: "Workflow",
  },
];

export function getCampaignCategory(id: string | null | undefined): CampaignCategory | undefined {
  if (!id) return undefined;
  if (id === "promotional") return CAMPAIGN_CATEGORIES.find((c) => c.id === "promotion");
  return CAMPAIGN_CATEGORIES.find((c) => c.id === id);
}

export type FollowUpConfig = {
  trigger?: string;
  delayHours?: number;
  followUpCount?: number;
  stopOnReply?: boolean;
  stopOnBooked?: boolean;
  stopOnPaid?: boolean;
  messages?: string[];
};

export type BroadcastConfig = {
  scheduleMode?: "now" | "later";
  scheduledAt?: string;
};

/** Build a runnable sequenceJson for a category + simple config. */
export function buildSequenceForCategory(
  categoryId: CampaignCategoryId,
  message: string,
  config: Record<string, unknown> = {},
): SequenceStep[] {
  const stopOnReply = config.stopOnReply !== false;
  const delayHours = Math.max(0, Number(config.delayHours ?? 24));
  const followUpCount = Math.min(5, Math.max(1, Number(config.followUpCount ?? 2)));
  const msg2 = String(config.message2 || "Just checking in — still happy to help. Reply anytime.");
  const msg3 = String(config.message3 || "Last note from us — reply STOP to opt out.");

  switch (categoryId) {
    case "broadcast":
    case "promotion":
      return [
        { step_key: "sms_1", step_type: "send_sms", config: { body: message, template_role: "broadcast" } },
        { step_key: "end", step_type: "end", config: {} },
      ];

    case "follow_up":
    case "lead_nurture":
    case "win_back": {
      const steps: SequenceStep[] = [
        { step_key: "sms_1", step_type: "send_sms", config: { body: message, template_role: "initial" } },
      ];
      for (let i = 1; i < followUpCount; i += 1) {
        const waitKey = `wait_${i}`;
        const smsKey = `sms_${i + 1}`;
        const gateKey = `gate_${i}`;
        steps.push({ step_key: waitKey, step_type: "wait", config: { hours: delayHours || 24 } });
        if (stopOnReply) {
          steps.push({
            step_key: gateKey,
            step_type: "condition",
            config: { when: "customer_replied", then: "end", else: smsKey },
          });
        }
        steps.push({
          step_key: smsKey,
          step_type: "send_sms",
          config: { body: i === 1 ? msg2 : msg3, template_role: `follow_up_${i + 1}` },
        });
      }
      steps.push({ step_key: "end", step_type: "end", config: {} });
      return steps;
    }

    case "welcome":
      return [
        { step_key: "sms_1", step_type: "send_sms", config: { body: message, template_role: "welcome" } },
        { step_key: "wait_1d", step_type: "wait", config: { hours: Number(config.delayHours ?? 24) } },
        {
          step_key: "sms_2",
          step_type: "send_sms",
          config: {
            body: msg2,
            template_role: "welcome_tip",
          },
        },
        { step_key: "end", step_type: "end", config: {} },
      ];

    case "appointment":
      return [
        {
          step_key: "sms_confirm",
          step_type: "send_sms",
          config: { body: message, template_role: "confirmation" },
        },
        { step_key: "wait_24h", step_type: "wait", config: { hours: Number(config.reminderHours ?? 24) } },
        {
          step_key: "sms_remind",
          step_type: "send_sms",
          config: {
            body: String(config.reminderMessage || "Reminder: your appointment is coming up. Reply C to confirm or X to cancel."),
            template_role: "reminder",
          },
        },
        { step_key: "end", step_type: "end", config: {} },
      ];

    case "missed_call":
      return [
        {
          step_key: "sms_1",
          step_type: "send_sms",
          config: {
            body: message || "Sorry we missed your call! How can we help? Reply here and we'll get back to you.",
            template_role: "missed_call",
          },
        },
        { step_key: "end", step_type: "end", config: {} },
      ];

    case "review":
      return [
        { step_key: "sms_1", step_type: "send_sms", config: { body: message, template_role: "review_ask" } },
        { step_key: "wait_2d", step_type: "wait", config: { days: Number(config.reminderDays ?? 2) } },
        {
          step_key: "gate_replied",
          step_type: "condition",
          config: { when: "customer_replied", then: "end", else: "sms_2" },
        },
        {
          step_key: "sms_2",
          step_type: "send_sms",
          config: {
            body: String(config.reminderMessage || "Quick reminder — we'd love your feedback when you have a moment."),
            template_role: "review_reminder",
          },
        },
        { step_key: "end", step_type: "end", config: {} },
      ];

    case "status_update":
      return [
        {
          step_key: "sms_1",
          step_type: "send_sms",
          config: { body: message, template_role: "status" },
        },
        { step_key: "end", step_type: "end", config: {} },
      ];

    case "payment":
      return [
        { step_key: "sms_1", step_type: "send_sms", config: { body: message, template_role: "invoice" } },
        { step_key: "wait_due", step_type: "wait", config: { days: Number(config.dueDays ?? 3) } },
        {
          step_key: "gate_paid",
          step_type: "condition",
          config: { when: "payment_received", then: "end", else: "sms_2" },
        },
        {
          step_key: "sms_2",
          step_type: "send_sms",
          config: {
            body: String(config.overdueMessage || "Friendly reminder: your payment is still due. Reply if you need help."),
            template_role: "overdue",
          },
        },
        { step_key: "end", step_type: "end", config: {} },
      ];

    case "event_rsvp":
      return [
        { step_key: "sms_invite", step_type: "send_sms", config: { body: message, template_role: "invite" } },
        { step_key: "wait_rsvp", step_type: "wait", config: { days: Number(config.rsvpDays ?? 3) } },
        {
          step_key: "gate_replied",
          step_type: "condition",
          config: { when: "customer_replied", then: "end", else: "sms_remind" },
        },
        {
          step_key: "sms_remind",
          step_type: "send_sms",
          config: {
            body: String(config.reminderMessage || "Reminder to RSVP — reply YES or NO. Hope to see you there!"),
            template_role: "rsvp_remind",
          },
        },
        { step_key: "end", step_type: "end", config: {} },
      ];

    case "data_collection":
      return [
        {
          step_key: "sms_ask",
          step_type: "send_sms",
          config: { body: message, template_role: "question" },
        },
        { step_key: "end", step_type: "end", config: {} },
      ];

    case "custom":
    default:
      return [
        { step_key: "sms_1", step_type: "send_sms", config: { body: message, template_role: "custom" } },
        { step_key: "end", step_type: "end", config: {} },
      ];
  }
}

export const DEFAULT_MESSAGES: Record<CampaignCategoryId, string> = {
  broadcast: "Hi {{first_name}}, quick update from us: … Reply STOP to opt out.",
  follow_up: "Hi {{first_name}}, just following up — still happy to help whenever you're ready.",
  welcome: "Welcome! Thanks for joining. Reply HELP for help or STOP to opt out.",
  appointment: "Hi {{first_name}}, your appointment is confirmed. Reply C to confirm or X to cancel.",
  missed_call: "Sorry we missed your call! Text us here and we'll help right away.",
  review: "Thanks for choosing us! Mind leaving a quick review? {{review_link}}",
  lead_nurture: "Hi {{first_name}}, here's a quick overview of how we can help: {{booking_link}}",
  win_back: "Hi {{first_name}}, it's been a while — we'd love to see you again. Book here: {{booking_link}}",
  promotion: "Hi {{first_name}}, enjoy {{offer}} this week only. Reply STOP to opt out.",
  status_update: "Update: your {{job_or_order}} status is now {{status}}.",
  payment: "Hi {{first_name}}, your invoice is ready: {{payment_link}}",
  event_rsvp: "You're invited! Reply YES or NO to RSVP. Details: {{event_link}}",
  data_collection: "Quick question — what service are you looking for? Just reply with a short answer.",
  custom: "Hi {{first_name}}, ",
};
