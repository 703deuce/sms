/**
 * Production number classes — each maps to a distinct compliance + provider regime.
 *
 * TWILIO_TOLL_FREE  → Twilio TFV, Twilio voice/SMS/webhooks
 * TELNYX_LOCAL_A2P  → Telnyx 10DLC/A2P, Telnyx voice/SMS/webhooks
 */
import { parseMessagingComplianceFromSettings } from "./messaging-compliance";

export type MctbProductionNumberClass = "TWILIO_TOLL_FREE" | "TELNYX_LOCAL_A2P";

export type MctbPhoneRole = "platform_demo" | "customer_production" | "customer_voice_only";

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
  const settings = asRecord(input.settingsJson);
  const stored = settings.mctbNumberClass;
  if (stored === "TWILIO_TOLL_FREE" || stored === "TELNYX_LOCAL_A2P") {
    return stored;
  }

  const compliance = parseMessagingComplianceFromSettings(input.settingsJson);
  if (compliance?.type === "TOLL_FREE_VERIFICATION") return "TWILIO_TOLL_FREE";
  if (compliance?.type === "A2P_10DLC") return "TELNYX_LOCAL_A2P";

  const provider = String(input.provider || "").toLowerCase();
  if (isTollFreeE164(input.e164) || /toll/i.test(String(input.type || ""))) {
    return "TWILIO_TOLL_FREE";
  }
  if (provider === "telnyx") return "TELNYX_LOCAL_A2P";
  if (provider === "twilio") return "TWILIO_TOLL_FREE";
  return "TELNYX_LOCAL_A2P";
}

export function parseMctbPhoneRole(settingsJson: unknown): MctbPhoneRole | null {
  const role = asRecord(settingsJson).mctbRole;
  if (role === "platform_demo" || role === "customer_production" || role === "customer_voice_only") {
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
