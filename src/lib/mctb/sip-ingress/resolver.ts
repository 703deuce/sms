import "server-only";

import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import {
  isMctbSipIngressTargetSync,
  isPhoneMctbSipIngress,
} from "@/lib/mctb/sip-ingress/sync";

export type MctbSipIngressResolution = {
  isMctbSipIngress: boolean;
  workspaceId: string | null;
  phoneNumberId: string | null;
  e164: string | null;
  source:
    | "platform_demo_e164"
    | "phone_settings"
    | "mctb_config_assignment"
    | "env_allowlist"
    | "none";
};

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { at: number; value: MctbSipIngressResolution }>();

function normalizeDid(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return normalizeE164(value);
  } catch {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
    return value.startsWith("+") ? value : null;
  }
}

/**
 * Resolve whether an inbound called DID should enter the frozen MCTB SIP/LiveKit handler.
 * Workspace is resolved from the assigned PhoneNumber row (sip.trunkPhoneNumber / called DID).
 */
export async function resolveMctbSipIngressByDid(
  toE164: string | null | undefined,
): Promise<MctbSipIngressResolution> {
  const e164 = normalizeDid(toE164);
  if (!e164) {
    return {
      isMctbSipIngress: false,
      workspaceId: null,
      phoneNumberId: null,
      e164: null,
      source: "none",
    };
  }

  const cached = cache.get(e164);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  let resolution: MctbSipIngressResolution = {
    isMctbSipIngress: false,
    workspaceId: null,
    phoneNumberId: null,
    e164,
    source: "none",
  };

  if (isMctbSipIngressTargetSync(e164)) {
    resolution = {
      isMctbSipIngress: true,
      workspaceId: null,
      phoneNumberId: null,
      e164,
      source: "platform_demo_e164",
    };
  }

  const pn = await getPrisma().phoneNumber.findFirst({
    where: { e164 },
    select: {
      id: true,
      workspaceId: true,
      settingsJson: true,
      status: true,
    },
  });

  if (pn && String(pn.status || "").toLowerCase() !== "released") {
    const settingsIngress = isPhoneMctbSipIngress(pn.settingsJson);
    const config = await loadMissedCallTextConfig(pn.workspaceId);
    const assignedIngress = config.enabled && config.phoneNumberId === pn.id;

    if (settingsIngress || assignedIngress) {
      resolution = {
        isMctbSipIngress: true,
        workspaceId: pn.workspaceId,
        phoneNumberId: pn.id,
        e164,
        source: settingsIngress ? "phone_settings" : "mctb_config_assignment",
      };
    }
  }

  cache.set(e164, { at: Date.now(), value: resolution });
  return resolution;
}

export async function isMctbSipIngressTarget(
  toE164: string | null | undefined,
): Promise<boolean> {
  if (isMctbSipIngressTargetSync(toE164)) return true;
  const resolved = await resolveMctbSipIngressByDid(toE164);
  return resolved.isMctbSipIngress;
}

export function clearMctbSipIngressCache() {
  cache.clear();
}

export { isMctbSipIngressTargetSync, isPhoneMctbSipIngress } from "@/lib/mctb/sip-ingress/sync";
