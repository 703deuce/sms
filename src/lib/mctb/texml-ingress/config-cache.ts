import "server-only";

import { getPrisma } from "@/lib/db";
import { readPhoneCapabilities } from "@/lib/numbers/phone-capabilities";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import {
  MCTB_TEXML_ROUTING_MODE,
  type MctbTexmlIngressBranch,
} from "./constants";

export type MctbTexmlIngressConfig = {
  workspaceId: string;
  phoneNumberId: string;
  e164: string;
  consentMode: MctbConsentMode;
  branch: MctbTexmlIngressBranch;
  routingMode: string;
  mctbEnabled: boolean;
  providerNumberId: string | null;
  texmlAppId: string | null;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expires: number; config: MctbTexmlIngressConfig }>();

function telephonyRoutingMode(settingsJson: unknown): string {
  const settings =
    settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
      ? (settingsJson as Record<string, unknown>)
      : {};
  const telephony = settings.telephony as Record<string, unknown> | undefined;
  const provisioning = settings.provisioning as Record<string, unknown> | undefined;
  return String(telephony?.routingMode || provisioning?.routingMode || "").toLowerCase();
}

function resolveBranch(routingMode: string, mctbEnabled: boolean): MctbTexmlIngressBranch {
  if (routingMode === MCTB_TEXML_ROUTING_MODE || mctbEnabled) return "mctb";
  if (routingMode === "telnyx_assistant") return "ai_assistant";
  return "mctb";
}

/** Fast DID lookup — one DB round-trip, cached 60s. */
export async function resolveMctbTexmlIngressConfig(
  toE164: string,
): Promise<MctbTexmlIngressConfig | null> {
  const key = toE164.replace(/\D/g, "");
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.config;

  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { e164: toE164 },
    select: {
      id: true,
      e164: true,
      workspaceId: true,
      providerNumberId: true,
      settingsJson: true,
    },
  });
  if (!phone?.e164) return null;

  const caps = readPhoneCapabilities({ settingsJson: phone.settingsJson });
  const routingMode = telephonyRoutingMode(phone.settingsJson);
  const settings = (phone.settingsJson || {}) as Record<string, unknown>;
  const telephony = (settings.telephony || {}) as Record<string, unknown>;

  let consentMode: MctbConsentMode = "press_1";
  try {
    consentMode = await loadMctbConsentMode(phone.workspaceId);
  } catch {
    // default press_1
  }

  const config: MctbTexmlIngressConfig = {
    workspaceId: phone.workspaceId,
    phoneNumberId: phone.id,
    e164: phone.e164,
    consentMode,
    branch: resolveBranch(routingMode, caps.mctbEnabled),
    routingMode,
    mctbEnabled: caps.mctbEnabled || routingMode === MCTB_TEXML_ROUTING_MODE,
    providerNumberId: phone.providerNumberId,
    texmlAppId: String(telephony.telnyxTexmlAppId || "") || null,
  };

  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, config });
  return config;
}

export function invalidateMctbTexmlIngressCache(e164?: string): void {
  if (!e164) {
    cache.clear();
    return;
  }
  cache.delete(e164.replace(/\D/g, ""));
}
