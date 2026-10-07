import { MCTB_ROUTES } from "@/lib/mctb/routes";
import {
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
  MCTB_PRO_MONTHLY_RECOVERY_LIMIT,
} from "@/lib/mctb/recovery-usage-constants";

export type MctbHelpArticleCategory = "Setup" | "Recovery" | "Compliance" | "Operations" | "Account";

export type MctbHelpBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export type MctbHelpArticle = {
  slug: string;
  title: string;
  description: string;
  category: MctbHelpArticleCategory;
  /** Primary in-app destination to apply what the guide describes */
  configureHref: string;
  configureLabel: string;
  blocks: MctbHelpBlock[];
};

const ARTICLES: MctbHelpArticle[] = [
  {
    slug: "phone-forwarding",
    title: "Phone & forwarding",
    description: "Connect your public business line with conditional forwarding to Transovo.",
    category: "Setup",
    configureHref: MCTB_ROUTES.phone,
    configureLabel: "Open Phone & Forwarding",
    blocks: [
      { type: "p", text: "Customers keep calling your existing business number. Transovo only sees calls your carrier forwards when you do not answer — we never replace your public line." },
      { type: "h2", text: "Three numbers to know" },
      { type: "ul", items: [
        "Business line — the number on your website and Google listing.",
        "Forwarding destination — the hidden toll-free ingress Transovo assigns to your workspace.",
        "Text-back sender — the number recovery SMS come from (platform toll-free by default, or your own number with the A2P add-on).",
      ]},
      { type: "h2", text: "Set up forwarding" },
      { type: "ol", items: [
        "Enter your business line and carrier in Phone & Forwarding.",
        "Follow the carrier guide for conditional / no-answer forwarding to your Transovo ingress.",
        "Place a test call from another phone, let it ring unanswered, then confirm verification in the app.",
      ]},
      { type: "h2", text: "Verification matters" },
      { type: "p", text: "\"I've turned it on\" is not the same as verified. We need evidence that a real unanswered call reached your workspace with the right caller ID before recovery can run reliably." },
      { type: "h2", text: "Pausing MCTB" },
      { type: "p", text: "Pausing recovery in the app does not turn off carrier forwarding. Calls may still reach Transovo; automated texts stop until you resume." },
    ],
  },
  {
    slug: "consent-compliance",
    title: "Consent & compliance",
    description: "Press-1 capture vs existing permission, and what callers experience.",
    category: "Compliance",
    configureHref: `${MCTB_ROUTES.missedCallRecovery}?tab=consent`,
    configureLabel: "Open consent settings",
    blocks: [
      { type: "p", text: "You must have permission to text missed callers. Transovo supports two setup modes — they are not interchangeable and produce different evidence." },
      { type: "h2", text: "Press 1" },
      { type: "ul", items: [
        "Caller hears a voice disclosure after the missed call is detected.",
        "They press 1 on the keypad to opt in.",
        "Transovo records consent with method, time, and disclosure version.",
        "A system compliance SMS is sent before your conversational recovery message.",
      ]},
      { type: "h2", text: "Existing permission" },
      { type: "ul", items: [
        "You attest that your business already has permission to text these callers.",
        "No Press-1 prompt or DTMF step on the call.",
        "Recovery SMS follows your configuration when the call qualifies as missed.",
      ]},
      { type: "h2", text: "Opt-out and STOP" },
      { type: "p", text: "Recipients can reply STOP at any time. Suppressed sends are intentional — they are not failures. Do not override opt-outs from the inbox." },
      { type: "h2", text: "Sender registration vs recipient consent" },
      { type: "p", text: "A2P / carrier brand approval for your own sending number is separate from whether a specific caller allowed texts. Platform toll-free sending uses Transovo's registration; your own local number requires the optional A2P add-on." },
    ],
  },
  {
    slug: "text-back-messages",
    title: "Text back & recovery messages",
    description: "Templates, platform sender, and what customers receive.",
    category: "Recovery",
    configureHref: MCTB_ROUTES.textBack,
    configureLabel: "Open Text Back",
    blocks: [
      { type: "p", text: "Recovery messages are the SMS your business sends after a qualified missed call. You control the conversational opener; compliance copy is fixed where carriers require it." },
      { type: "h2", text: "Platform sender (default)" },
      { type: "p", text: "On the Free and Pro plans you can send from Transovo's platform toll-free without filing your own A2P campaign. This is the fastest way to start." },
      { type: "h2", text: "Recovery strategies (templates)" },
      { type: "ul", items: [
        `Free — ${2} strategies (Simple, What do you need?).`,
        `Pro — all 5 strategies, including after-hours wording variants.`,
      ]},
      { type: "h2", text: "Press-1 message order" },
      { type: "ol", items: [
        "System compliance confirmation (locked, Transovo-authored).",
        "Your editable conversation opener.",
      ]},
      { type: "p", text: "These are two distinct messages — never merged into one \"first text\" in setup or in the conversation thread." },
      { type: "h2", text: "Own local number (optional)" },
      { type: "p", text: "Add the customer-owned messaging add-on if you want texts to show your local caller ID. Carrier registration and approval still apply." },
    ],
  },
  {
    slug: "missed-call-recovery-rules",
    title: "Missed-call recovery rules",
    description: "Which call outcomes create a missed call and when recovery runs.",
    category: "Recovery",
    configureHref: MCTB_ROUTES.missedCallRecovery,
    configureLabel: "Open Missed-Call Recovery",
    blocks: [
      { type: "p", text: "Recovery rules decide whether an unanswered call becomes a missed-call event. Consent, sender readiness, and monthly limits are checked afterward." },
      { type: "h2", text: "Typical triggers" },
      { type: "ul", items: [
        "No answer",
        "Busy",
        "Unreachable (when supported by your carrier path)",
      ]},
      { type: "h2", text: "Recovery goal" },
      { type: "p", text: "Describe what you want to learn from the caller (project type, urgency, callback window). This shapes automatic acknowledgment copy — it is not an unlimited AI chatbot." },
      { type: "h2", text: "Cooldowns and repeat callers" },
      { type: "p", text: "Repeat calls are separate events. Cooldowns limit duplicate automated texts to the same person; they do not merge separate missed calls into one record." },
      { type: "h2", text: "Pause recovery" },
      { type: "p", text: "Operational pause stops automated recovery texts without disabling forwarding. No backlog blast when you resume." },
    ],
  },
  {
    slug: "team-notifications",
    title: "Team notifications",
    description: "Email and SMS alerts when something needs attention.",
    category: "Operations",
    configureHref: MCTB_ROUTES.notifications,
    configureLabel: "Open Notifications",
    blocks: [
      { type: "p", text: "Notifications tell your team when a missed call, reply, or voicemail needs follow-up — without watching the inbox all day." },
      { type: "h2", text: "Free plan" },
      { type: "p", text: "Email alerts for missed calls, customer replies, and voicemail events." },
      { type: "h2", text: "Pro plan" },
      { type: "p", text: "Email plus SMS alerts so the right person can respond immediately." },
      { type: "h2", text: "What notifications are not" },
      { type: "ul", items: [
        "They do not send marketing blasts to your contact list.",
        "They do not replace the Conversations inbox — they point you to it.",
      ]},
    ],
  },
  {
    slug: "troubleshooting-and-test",
    title: "Troubleshooting & live test",
    description: "Verify forwarding, consent, and recovery end to end.",
    category: "Setup",
    configureHref: MCTB_ROUTES.setupTest,
    configureLabel: "Open setup test",
    blocks: [
      { type: "p", text: "Use the in-app live test after forwarding is configured. Call your public business line from another phone and let it ring unanswered." },
      { type: "h2", text: "Checklist" },
      { type: "ol", items: [
        "Forwarding shows verified in Phone & Forwarding.",
        "Consent mode matches how you operate (Press-1 vs existing permission).",
        "Text-back sender is ready (platform sender is immediate; own number needs carrier approval).",
        "You have recoveries remaining this month on your plan.",
        "Caller is not on your exclusion list and has not opted out.",
      ]},
      { type: "h2", text: "Press-1 test" },
      { type: "p", text: "Recovery SMS only sends after the caller presses 1. If they hang up early, you will see the missed call but not a recovery text." },
      { type: "h2", text: "Still stuck?" },
      { type: "p", text: "Open the missed-call detail record for the test event — the timeline shows suppression reasons and delivery states without guessing from timestamps alone." },
    ],
  },
  {
    slug: "conversations-inbox",
    title: "Conversations",
    description: "Reply to missed callers and track handoff status.",
    category: "Operations",
    configureHref: MCTB_ROUTES.conversations,
    configureLabel: "Open Conversations",
    blocks: [
      { type: "p", text: "Conversations is the shared SMS thread for each caller. Threads started from missed-call recovery show that context in the header." },
      { type: "h2", text: "What you will see" },
      { type: "ul", items: [
        "Compliance confirmation and recovery messages as separate bubbles when Press-1 applies.",
        "Delivery states from the carrier — not guessed in the UI.",
        "Opt-out as a system event; suppressed sends are not shown as sent.",
      ]},
      { type: "h2", text: "Replying" },
      { type: "p", text: "The composer checks eligibility before send. Opted-out callers, unavailable senders, and permission limits block the composer with a clear reason." },
      { type: "h2", text: "Needs follow-up" },
      { type: "p", text: "Mark threads handled or leave them needing follow-up so your team shares one definition of \"needs reply\" across Overview, Missed Calls, and Analytics." },
    ],
  },
  {
    slug: "voicemail",
    title: "Voicemail",
    description: "Listen, read transcripts, and follow up from visual voicemail.",
    category: "Operations",
    configureHref: MCTB_ROUTES.voicemail,
    configureLabel: "Open Voicemail",
    blocks: [
      { type: "p", text: "Voicemail is an operational inbox — greeting configuration lives under setup, not inside the inbox." },
      { type: "h2", text: "What to trust" },
      { type: "ul", items: [
        "Original audio recording is authoritative.",
        "Transcript and AI summary are derived and labeled as such.",
      ]},
      { type: "h2", text: "Follow up" },
      { type: "p", text: "Jump to the related missed call or conversation, call the customer back, or mark reviewed when your team has handled it." },
    ],
  },
  {
    slug: "missed-calls-workspace",
    title: "Missed calls list & detail",
    description: "Statuses, recovery outcomes, and next actions.",
    category: "Operations",
    configureHref: MCTB_ROUTES.missedCalls,
    configureLabel: "Open Missed Calls",
    blocks: [
      { type: "p", text: "Every row is one missed-call event — repeat callers create separate rows." },
      { type: "h2", text: "Recovery column" },
      { type: "p", text: "Shows authoritative runtime state: waiting for consent, delivered, suppressed, failed, and more. Suppressed is not the same as failed." },
      { type: "h2", text: "Detail page" },
      { type: "ul", items: [
        "Call → consent → compliance text → recovery text → reply timeline.",
        "Links to conversation, consent evidence, and voicemail when present.",
        "One dominant next action based on state — no fake resend or override controls.",
      ]},
    ],
  },
  {
    slug: "analytics-metrics",
    title: "Analytics",
    description: "Funnel metrics and how they relate to daily work.",
    category: "Operations",
    configureHref: MCTB_ROUTES.analytics,
    configureLabel: "Open Analytics",
    blocks: [
      { type: "p", text: "Analytics measures the recovery funnel with the same definitions as Overview and Missed Calls." },
      { type: "h2", text: "Core metrics" },
      { type: "ul", items: [
        "Missed calls",
        "Recovery texts sent (excludes Press-1 compliance-only messages in KPIs where documented)",
        "Customers replied",
        "Suppression reasons — distinct from failures",
      ]},
      { type: "h2", text: "Pro vs Free" },
      { type: "p", text: "Pro includes deeper funnel views and drilldowns. Free still shows core usage so you can see whether recovery is working." },
      { type: "h2", text: "Drilldowns" },
      { type: "p", text: "Use date-range links to open Missed Calls or Conversations with filters preserved." },
    ],
  },
  {
    slug: "plans-billing",
    title: "Plans, billing & limits",
    description: "Free vs Pro, recoveries per month, and upgrading.",
    category: "Account",
    configureHref: "/settings/billing",
    configureLabel: "Open Billing & plans",
    blocks: [
      { type: "p", text: "Both plans can use the platform toll-free sender without your own A2P registration." },
      { type: "h2", text: "Free" },
      { type: "ul", items: [
        `$0 — ${MCTB_FREE_MONTHLY_RECOVERY_LIMIT} recoveries per month`,
        "Email team alerts",
        "2 recovery message strategies",
      ]},
      { type: "h2", text: "Pro" },
      { type: "ul", items: [
        `$19.99/mo — ${MCTB_PRO_MONTHLY_RECOVERY_LIMIT} recoveries per month`,
        "Email + SMS team alerts",
        "All 5 recovery strategies and booking links",
        "Full analytics drilldowns",
      ]},
      { type: "h2", text: "What counts as a recovery" },
      { type: "p", text: "A recovery counts when the first automated recovery SMS is accepted for sending — not when the call is missed. Voicemail and call history continue after you hit the text-back limit." },
      { type: "h2", text: "Upgrade or downgrade" },
      { type: "p", text: "Upgrade from Billing & plans in the header menu. You can cancel Pro at period end or immediately and return to Free without hiding the controls." },
    ],
  },
  {
    slug: "account-and-support",
    title: "Account, profile & support",
    description: "Workspace settings, team access, and where to get help.",
    category: "Account",
    configureHref: "/settings/business",
    configureLabel: "Open business profile",
    blocks: [
      { type: "h2", text: "Profile & business" },
      { type: "p", text: "Business name and profile fields feed recovery templates and caller-facing copy. Keep them accurate before going live." },
      { type: "h2", text: "Billing" },
      { type: "p", text: "Use the avatar menu → Billing & plans for subscription, payment method (Stripe portal), and plan changes." },
      { type: "h2", text: "Team & security" },
      { type: "p", text: "Invite staff from Settings → Users. Use Security for password and session controls." },
      { type: "h2", text: "Consent audit" },
      { type: "p", text: `Review captured consent events in the consent log (${MCTB_ROUTES.complianceConsent}) when you need evidence for a specific caller.` },
      { type: "h2", text: "Contact support" },
      { type: "p", text: "If this guide does not resolve your issue, contact Transovo support with your workspace name, a missed-call ID, and the approximate time of the test call." },
    ],
  },
];

const BY_SLUG = new Map(ARTICLES.map((a) => [a.slug, a]));

export function listMctbHelpArticles(): MctbHelpArticle[] {
  return [...ARTICLES];
}

export function getMctbHelpArticle(slug: string): MctbHelpArticle | null {
  return BY_SLUG.get(slug) ?? null;
}

export function mctbHelpArticleSlugs(): string[] {
  return ARTICLES.map((a) => a.slug);
}
