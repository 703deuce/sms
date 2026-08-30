import "server-only";

import { getPrisma } from "@/lib/db";
import { readPhoneCapabilities } from "@/lib/numbers/phone-capabilities";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { resolveMctbAssignedWorkspaceForPhone } from "@/lib/mctb/sip-ingress/resolver";
import { isMctbTexmlVoiceIngress } from "@/lib/mctb/sip-ingress/sync";
import {
  MCTB_TEXML_ROUTING_MODE,
  type MctbTexmlIngressBranch,
} from "./constants";
import { mctbTexmlE164Variants } from "./e164-lookup";
import { resolveBestMctbIngressPhoneRow, isArchivedIngressRow } from "./resolve-phone-row";

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
  return String(
    telephony?.routingMode ||
      provisioning?.routingMode ||
      settings.routingOwner ||
      "",
  ).toLowerCase();
}

function resolveBranch(routingMode: string, mctbEnabled: boolean): MctbTexmlIngressBranch | null {
  if (routingMode === MCTB_TEXML_ROUTING_MODE || mctbEnabled) return "mctb";
  if (routingMode === "telnyx_assistant") return "ai_assistant";
  return null;
}

/** Fast DID lookup — one DB round-trip, cached 60s. Workspace = assigned tenant, not phone row owner. */
export async function resolveMctbTexmlIngressConfig(
  toE164: string,
): Promise<MctbTexmlIngressConfig | null> {
  const variants = mctbTexmlE164Variants(toE164);
  if (!variants.length) return null;

  const key = variants[0]!.replace(/\D/g, "");
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    let consentMode: MctbConsentMode = hit.config.consentMode;
    try {
      consentMode = await loadMctbConsentMode(hit.config.workspaceId);
    } catch {
      // keep cached consent mode
    }
    return { ...hit.config, consentMode };
  }

  const prisma = getPrisma();
  const phone = await resolveBestMctbIngressPhoneRow(toE164);
  if (!phone?.e164) return null;
  if (isArchivedIngressRow(phone.settingsJson)) return null;

  const caps = readPhoneCapabilities({ settingsJson: phone.settingsJson });
  const routingMode = telephonyRoutingMode(phone.settingsJson);
  const settings = (phone.settingsJson || {}) as Record<string, unknown>;
  const telephony = (settings.telephony || {}) as Record<string, unknown>;
  const mctbEnabled = caps.mctbEnabled || routingMode === MCTB_TEXML_ROUTING_MODE;
  const branch = resolveBranch(routingMode, mctbEnabled);
  const texmlIngress = isMctbTexmlVoiceIngress(phone.settingsJson);

  if (!branch || branch !== "mctb" || !mctbEnabled) {
    return null;
  }

  const assignedWorkspaceId =
    (await resolveMctbAssignedWorkspaceForPhone({
      phoneNumberId: phone.id,
      ownerWorkspaceId: phone.workspaceId,
      settingsJson: phone.settingsJson,
    })) ?? (texmlIngress || mctbEnabled ? phone.workspaceId : null);
  if (!assignedWorkspaceId) return null;

  let consentMode: MctbConsentMode = "press_1";
  try {
    consentMode = await loadMctbConsentMode(assignedWorkspaceId);
  } catch {
    // default press_1
  }

  const config: MctbTexmlIngressConfig = {
    workspaceId: assignedWorkspaceId,
    phoneNumberId: phone.id,
    e164: phone.e164,
    consentMode,
    branch,
    routingMode,
    mctbEnabled,
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
  for (const variant of mctbTexmlE164Variants(e164)) {
    cache.delete(variant.replace(/\D/g, ""));
  }
}

/** Invalidate ingress cache for every DID tied to a workspace (owner or linked assignment). */
export async function invalidateMctbTexmlIngressCacheForWorkspace(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const owned = await prisma.phoneNumber.findMany({
    where: { workspaceId },
    select: { e164: true, settingsJson: true },
  });
  const e164s = new Set<string>();
  for (const phone of owned) {
    if (phone.e164) e164s.add(phone.e164);
  }

  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const runtime = await loadMissedCallTextConfig(workspaceId);
  if (runtime.phoneNumberId) {
    const assigned = await prisma.phoneNumber.findUnique({
      where: { id: runtime.phoneNumberId },
      select: { e164: true },
    });
    if (assigned?.e164) e164s.add(assigned.e164);
  }

  for (const e164 of e164s) {
    invalidateMctbTexmlIngressCache(e164);
  }
}
