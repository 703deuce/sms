/**
 * Final go-live certification group manifest — every APT / MCTB / CROSS / GLOBAL id.
 */
import type { CertStatus } from "../lib";

export type CertProduct = "appointments" | "mctb" | "cross" | "global";

export type CertGroupManifest = {
  id: string;
  product: CertProduct;
  title: string;
  /** When set, recorded without browser (no false PASS). */
  blocked?: CertStatus;
  primaryRoute?: string;
};

function apt(id: string, title: string, route?: string, blocked?: CertStatus): CertGroupManifest {
  return { id: `APT-${id}`, product: "appointments", title, primaryRoute: route, blocked };
}

function mctb(id: string, title: string, route?: string, blocked?: CertStatus): CertGroupManifest {
  return { id: `MCTB-${id}`, product: "mctb", title, primaryRoute: route, blocked };
}

function cross(
  id: string,
  title: string,
  route?: string,
  blocked?: CertStatus,
): CertGroupManifest {
  return { id: `CROSS-${id}`, product: "cross", title, primaryRoute: route, blocked };
}

function global(id: string, title: string): CertGroupManifest {
  return { id: `GLOBAL-${id}`, product: "global", title };
}

export const CERT_GROUP_MANIFEST: CertGroupManifest[] = [
  apt("01", "Product navigation"),
  apt("02", "Appointments Home", "/appointments/overview"),
  apt("03", "Calendar", "/appointments/calendar"),
  apt("04", "Appointment List", "/appointments"),
  apt("05", "Manual Appointment Creation", "/appointments/new"),
  apt("06", "Appointment Detail"),
  apt("07", "Edit Appointment"),
  apt("08", "Reschedule"),
  apt("09", "Cancellation"),
  apt("10", "Appointment Status Lifecycle"),
  apt("11", "Booking Types", "/appointments/types"),
  apt("12", "Public Booking Pages", "/appointments/booking"),
  apt("13", "Full Public Booking Flow"),
  apt("14", "Booking Protection"),
  apt("15", "Approval-Based Booking"),
  apt("16", "Availability", "/appointments/availability"),
  apt("17", "Staff", "/appointments/staff"),
  apt("18", "Locations", "/appointments/locations"),
  apt("19", "External Calendar Blocking", undefined, "BLOCKED — LIVE EXTERNAL PROVIDER"),
  apt("20", "Routing Forms", "/appointments/routing-forms"),
  apt("21", "Routing Rules", "/appointments/routing"),
  apt("22", "Waitlist", "/appointments/waitlist"),
  apt("23", "Recalls", "/appointments/recalls"),
  apt("24", "Recall Campaigns", "/appointments/recall-campaigns"),
  apt("25", "No-Show Recovery", "/appointments/no-show-recovery"),
  apt("26", "Scheduling Groups / Enterprise", "/appointments/enterprise"),
  apt("27", "Team Booking Pages", "/appointments/team-pages"),
  apt("28", "Meeting Polls", "/appointments/polls"),
  apt("29", "Single-Use Links"),
  apt("30", "Contacts", "/contacts"),
  apt("31", "Conversations", "/conversations"),
  apt("32", "Confirmation Messages"),
  apt("33", "Reminder Sequences", "/appointments/reminders"),
  apt("34", "Voice Reminder Configuration", "/appointments/voice-reminders"),
  apt("35", "Workflow Builder", "/appointments/workflows"),
  apt("36", "Workflow Templates", "/appointments/automations/templates"),
  apt("37", "Workflow Activity", "/appointments/automations/activity"),
  apt("38", "Workflow AI Architect"),
  apt("39", "AI Write Verifier"),
  apt("40", "AI Booking Settings", "/appointments/ai-booking"),
  apt("41", "Public AI Booking"),
  apt("42", "SMS AI Booking"),
  apt("43", "Email AI Booking"),
  apt("44", "Owner Amy"),
  apt("45", "Caller Amy", undefined, "BLOCKED — LIVE PSTN"),
  apt("46", "Transovo Video Settings", "/video"),
  apt("47", "Transovo Video Appointment Creation"),
  apt("48", "Transovo Video Host", undefined, "BLOCKED — LIVE MEDIA"),
  apt("49", "Public Video Guest Join"),
  apt("50", "AI Notetaker Global Settings", "/settings/ai-notetaker"),
  apt("51", "Notetaker Booking-Type Defaults", "/appointments/types"),
  apt("52", "Per-Appointment Notetaker"),
  apt("53", "External Meeting Link + Notetaker"),
  apt("54", "Notetaker Join Rules", "/settings/ai-notetaker"),
  apt("55", "Notetaker Meeting Lifecycle", undefined, "BLOCKED — LIVE EXTERNAL PROVIDER"),
  apt("56", "Notetaker Failure Paths"),
  apt("57", "Meeting Recaps", "/meetings"),
  apt("58", "Searchable Meeting Notes", undefined, "NOT IMPLEMENTED"),
  apt("59", "Public Recap Sharing"),
  apt("60", "Notetaker Retention", "/settings/ai-notetaker"),
  apt("61", "Automatic External Meeting Creation", undefined, "NOT IMPLEMENTED"),
  apt("62", "Appointment Analytics Overview", "/appointments/analytics"),
  apt("63", "Booking Analytics", "/appointments/analytics/booking"),
  apt("64", "Reminder Analytics", "/appointments/analytics/reminders"),
  apt("65", "Automation Analytics", "/appointments/analytics/automations"),
  apt("66", "Reports / Export", "/appointments/analytics/reports"),
  apt("67", "Appointment Setup Wizard", "/appointments/setup"),
  apt("68", "Appointment Integrations Hub", "/appointments/integrations"),
  apt("69", "Appointment Settings", "/settings/business"),

  mctb("01", "Product navigation"),
  mctb("02", "Home", "/mctb"),
  mctb("03", "Guided Setup Wizard", "/mctb/setup/start"),
  mctb("04", "Setup Overview", "/mctb/setup"),
  mctb("05", "Phone & Forwarding", "/mctb/setup/phone"),
  mctb("06", "Missed Call Rules", "/mctb/setup/missed-call-rules"),
  mctb("07", "Consent: Press 1 Configuration", "/mctb/setup/consent"),
  mctb("08", "Press 1 Runtime Sequence"),
  mctb("09", "Existing Consent Configuration", "/mctb/setup/consent"),
  mctb("10", "Existing Consent Runtime"),
  mctb("11", "Consent Log", "/mctb/compliance/consent"),
  mctb("12", "Text Back Settings", "/mctb/setup/text-back"),
  mctb("13", "Request Form & Default Link Setup", "/mctb/setup/links"),
  mctb("14", "Public Request Form"),
  mctb("15", "Numbers", "/mctb/numbers"),
  mctb("16", "Toll-Free Verification / Sender Readiness"),
  mctb("17", "Local 10DLC Sender", undefined, "INTENTIONALLY DEFERRED"),
  mctb("18", "Dedicated Text Number Voice Behavior", undefined, "INTENTIONALLY DEFERRED"),
  mctb("19", "Recovery Controls", "/mctb/setup/recovery"),
  mctb("20", "Schedule/Legacy Compatibility"),
  mctb("21", "Optional One-Time Follow-Up", undefined, "INTENTIONALLY DEFERRED"),
  mctb("22", "Exclusions", "/mctb/setup/exclusions"),
  mctb("23", "STOP / HELP"),
  mctb("24", "Core Recovery Pipeline"),
  mctb("25", "Recovery Delay"),
  mctb("26", "Eligibility Engine"),
  mctb("27", "Repeat Caller"),
  mctb("28", "Missed Calls List", "/mctb/missed-calls"),
  mctb("29", "Missed Call Detail"),
  mctb("30", "Conversations", "/mctb/conversations"),
  mctb("31", "Notify-Only Mode", "/mctb/setup/notifications"),
  mctb("32", "Guided Collection Mode", "/mctb/setup/notifications"),
  mctb("33", "AI Conversation Mode", "/mctb/setup/notifications"),
  mctb("34", "Immediate Handoff Mode", "/mctb/setup/notifications"),
  mctb("35", "Lead Fields", "/mctb/setup/notifications"),
  mctb("36", "Emergency Detection Off", "/mctb/setup/notifications"),
  mctb("37", "Emergency Detection On", "/mctb/setup/notifications"),
  mctb("38", "Emergency Uncertainty", "/mctb/setup/notifications"),
  mctb("39", "Callback Requests"),
  mctb("40", "Human Takeover", "/mctb/conversations"),
  mctb("41", "Notifications Recipients", "/mctb/setup/notifications"),
  mctb("42", "Notification Routing Matrix", "/mctb/setup/notifications"),
  mctb("43", "Notification Quiet Hours", "/mctb/setup/notifications"),
  mctb("44", "Notification Delivery"),
  mctb("45", "Lead Handoff Summary"),
  mctb("46", "Booking Behavior", "/mctb/setup/notifications"),
  mctb("47", "MCTB → Appointment Booking"),
  mctb("48", "Tracked Links", "/mctb/setup/links"),
  mctb("49", "Voicemail Setup", "/mctb/setup/voicemail"),
  mctb("50", "Voicemail Greeting Replacement Safety", "/mctb/setup/voicemail"),
  mctb("51", "Visual Voicemail Inbox", "/mctb/voicemail"),
  mctb("52", "Voicemail AI", "/mctb/voicemail"),
  mctb("53", "MCTB Disabled / Voicemail Active"),
  mctb("54", "Test & Diagnostics", "/mctb/setup/test"),
  mctb("55", "Try It / Demo", "/mctb/setup/test"),
  mctb("56", "MCTB Analytics", "/mctb/analytics"),
  mctb("57", "Legacy Redirects"),
  mctb("58", "Feature Flags / Entitlements"),

  cross("01", "Product Switching"),
  cross("02", "Shared Contacts", "/contacts"),
  cross("03", "Shared Conversations", "/conversations"),
  cross("04", "MCTB Booking Attribution"),
  cross("05", "MCTB Booking → Appointment Reminder Lifecycle"),
  cross("06", "Appointment → AI Notetaker → Recap"),
  cross("07", "Transovo Video → AI Notetaker"),
  cross("08", "External Video → AI Notetaker", undefined, "BLOCKED — LIVE EXTERNAL PROVIDER"),

  global("01", "Global frontend UI quality pass"),
  global("02", "Public token / link safety"),
  global("03", "Time / timezone certification"),
  global("04", "Duplicate / retry certification"),
];

export const CERT_GROUP_IDS = CERT_GROUP_MANIFEST.map((g) => g.id);