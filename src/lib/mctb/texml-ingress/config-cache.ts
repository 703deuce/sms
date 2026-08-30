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
  /** Cached schedule gate — warm via warmMctbTexmlIngressCache(). */
  automationActive: boolean;
};

type CacheEntry = { expires: number; config: MctbTexmlIngressConfig };
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKeyForE164(toE164: string): string | null {
  const variants = mctbTexmlE164Variants(toE164);
  return variants[0]?.replace(/\D/g, "") || null;
}

/** Sync read for mctb-entry fast path (no DB). */
export function peekMctbTexmlIngressCache(toE164: string): MctbTexmlIngressConfig | null {
  const key = cacheKeyForE164(toE164);
  if (!key) return null;
  const hit = cache.get(key);
  if (!hit || hit.expires <= Date.now()) return null;
  return hit.config;
}

async function loadAutomationActive(workspaceId: string): Promise<boolean> {
  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const { loadMctbScheduleSettings, isMctbAutomationActive } = await import("@/lib/mctb/schedule");
  const runtimeConfig = await loadMissedCallTextConfig(workspaceId);
  const scheduleSettings = await loadMctbScheduleSettings(workspaceId, runtimeConfig);
  return isMctbAutomationActive(scheduleSettings, runtimeConfig);
}

/** Populate ingress cache after setup/provision so forwarded calls avoid cold DB. */
export async function warmMctbTexmlIngressCache(e164: string): Promise<MctbTexmlIngressConfig | null> {
  invalidateMctbTexmlIngressCache(e164);
  return resolveMctbTexmlIngressConfig(e164);
}

export async function warmMctbTexmlIngressCacheForWorkspace(workspaceId: string): Promise<void> {
  const prisma = getPrisma();
  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const runtime = await loadMissedCallTextConfig(workspaceId);
  const e164s = new Set<string>();
  if (runtime.phoneNumberId) {
    const phone = await prisma.phoneNumber.findUnique({
      where: { id: runtime.phoneNumberId },
      select: { e164: true },
    });
    if (phone?.e164) e164s.add(phone.e164);
  }
  const owned = await prisma.phoneNumber.findMany({
    where: { workspaceId, status: { not: "Released" } },
    select: { e164: true },
  });
  for (const row of owned) {
    if (row.e164) e164s.add(row.e164);
  }
  await Promise.all([...e164s].map((e164) => warmMctbTexmlIngressCache(e164)));
}

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
    return hit.config;
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

  let automationActive = true;
  if (consentMode !== "existing_consent") {
    try {
      automationActive = await loadAutomationActive(assignedWorkspaceId);
    } catch {
      automationActive = true;
    }
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
    automationActive,
  };

  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, config });
  return config;
}

export function invalidateMctbTexmlIngressCache(e164?: string): void {
  if (!e164) {
    cache.clear();
    void import("./routing-profile").then((m) => m.invalidateMctbInboundRoutingProfile());
    return;
  }
  for (const variant of mctbTexmlE164Variants(e164)) {
    cache.delete(variant.replace(/\D/g, ""));
  }
  void import("./routing-profile").then((m) => m.invalidateMctbInboundRoutingProfile(e164));
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
  const { warmMctbInboundRoutingProfileForWorkspace } = await import("./routing-profile");
  await warmMctbInboundRoutingProfileForWorkspace(workspaceId);
}
