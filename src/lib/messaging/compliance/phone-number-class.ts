/**
 * Production number classes — each maps to a distinct compliance + provider regime.
 *
 * TWILIO_TOLL_FREE  → Twilio TFV, Twilio voice/SMS/webhooks
 * TELNYX_LOCAL_A2P  → Telnyx 10DLC/A2P, Telnyx voice/SMS/webhooks
 */
import { parseMessagingComplianceFromSettings } from "./messaging-compliance";

export type MctbProductionNumberClass = "TWILIO_TOLL_FREE" | "TELNYX_LOCAL_A2P";

export type MctbPhoneRole =
  | "platform_demo"
  | "platform_mctb_sender"
  | "customer_production"
  | "customer_voice_only";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isTollFreeE164(e164: string): boolean {
  const d = e164.replace(/\D/g, "");
  const national = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return /^8\d{2}/.test(national);
}

export function classifyProductionNumber(input: {
  e164: string;
  provider?: string | null;
  type?: string | null;
  settingsJson?: unknown;
}): MctbProductionNumberClass {
  // Toll-free NPAs (800/866/etc.) are never 10DLC local — ignore stale A2P labels on the row.
  if (isTollFreeE164(input.e164) || /toll/i.test(String(input.type || ""))) {
    return "TWILIO_TOLL_FREE";
  }

  const settings = asRecord(input.settingsJson);
  const stored = settings.mctbNumberClass;
  if (stored === "TWILIO_TOLL_FREE" || stored === "TELNYX_LOCAL_A2P") {
    return stored;
  }

  const compliance = parseMessagingComplianceFromSettings(input.settingsJson);
  if (compliance?.type === "TOLL_FREE_VERIFICATION") return "TWILIO_TOLL_FREE";
  if (compliance?.type === "A2P_10DLC") return "TELNYX_LOCAL_A2P";

  const provider = String(input.provider || "").toLowerCase();
  if (provider === "telnyx") return "TELNYX_LOCAL_A2P";
  if (provider === "twilio") return "TWILIO_TOLL_FREE";
  return "TELNYX_LOCAL_A2P";
}

export function parseMctbPhoneRole(settingsJson: unknown): MctbPhoneRole | null {
  const role = asRecord(settingsJson).mctbRole;
  if (
    role === "platform_demo" ||
    role === "platform_mctb_sender" ||
    role === "customer_production" ||
    role === "customer_voice_only"
  ) {
    return role;
  }
  return null;
}

export function isPlatformDemoPhoneRecord(input: {
  e164: string;
  settingsJson?: unknown;
}): boolean {
  return parseMctbPhoneRole(input.settingsJson) === "platform_demo";
}

export function isPlatformMctbSenderPhoneRecord(input: {
  settingsJson?: unknown;
}): boolean {
  if (parseMctbPhoneRole(input.settingsJson) === "platform_mctb_sender") {
    return true;
  }
  const settings = asRecord(input.settingsJson);
  return settings.platformMctbSender === true;
}

/** Canonical Transovo platform MCTB sender row (not customer-owned numbers). */
export function isCanonicalPlatformMctbSenderPhone(input: {
  phoneNumberId: string;
  settingsJson: unknown;
  canonical: { phoneNumberId: string } | null;
}): boolean {
  if (!input.canonical || input.canonical.phoneNumberId !== input.phoneNumberId) {
    return false;
  }
  return isPlatformMctbSenderPhoneRecord({ settingsJson: input.settingsJson });
}

/** Twilio platform TFN retained after primary switch to Telnyx (not canonical). */
export function isPreservedTwilioPlatformMctbSenderRecord(input: {
  settingsJson?: unknown;
}): boolean {
  const settings = asRecord(input.settingsJson);
  return settings.platformMctbSenderPreservedTwilio === true;
}

export function platformMctbSenderSettings(input?: {
  tfvApproved?: boolean;
  provider?: "twilio" | "telnyx";
  /** Telnyx 866/800/etc. — same TFV regime as Twilio toll-free, not 10DLC. */
  isTollFree?: boolean;
  /** When true, keep existing voice ingress role (e.g. customer_mctb) on the same DID. */
  dualVoiceIngress?: boolean;
}): Record<string, unknown> {
  const provider = input?.provider || "twilio";
  const approved = input?.tfvApproved ?? true;
  const tollFree = input?.isTollFree ?? provider === "twilio";
  const base: Record<string, unknown> = {
    mctbNumberClass: tollFree ? "TWILIO_TOLL_FREE" : "TELNYX_LOCAL_A2P",
    platformMctbSender: true,
    messagingCompliance: {
      type: tollFree ? "TOLL_FREE_VERIFICATION" : "A2P_10DLC",
      status: approved ? "APPROVED" : "NOT_STARTED",
    },
  };
  if (input?.dualVoiceIngress) {
    return base;
  }
  return { ...base, mctbRole: "platform_mctb_sender" as const };
}

export function tollFreeComplianceSettings(): Record<string, unknown> {
  return {
    mctbNumberClass: "TWILIO_TOLL_FREE" as const,
    mctbRole: "customer_production" as const,
    messagingCompliance: { type: "TOLL_FREE_VERIFICATION", status: "NOT_STARTED" },
  };
}

export function telnyxLocalA2pSettings(input?: {
  role?: MctbPhoneRole;
  a2pApproved?: boolean;
}): Record<string, unknown> {
  return {
    mctbNumberClass: "TELNYX_LOCAL_A2P" as const,
    mctbRole: input?.role || "customer_production",
    mctbSipIngress: true,
    messagingCompliance: {
      type: "A2P_10DLC",
      status: input?.a2pApproved ? "APPROVED" : "NOT_STARTED",
    },
  };
}
