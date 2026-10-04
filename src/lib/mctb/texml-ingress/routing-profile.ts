import "server-only";

import { createHash } from "crypto";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { getMctbConsentPlaybackUrl, getMctbTexmlVoicemailRecordCallbackUrl } from "@/lib/mctb/consent-prompt/texml-response";
import {
  greetingTokenForE164,
  platformVoicemailGreetingPlayUrl as platformDefaultVoicemailUrl,
  resolveStableVoicemailGreetingPlayUrl,
} from "@/lib/phone/voicemail-active-greeting";
import { mctbTexmlE164Variants } from "./e164-lookup";

export type MctbVoicemailGreetingKind = "platform_default" | "custom";

export type MctbInboundRoutingProfile = {
  routingToken: string;
  greetingToken: string;
  workspaceId: string;
  phoneNumberId: string;
  e164: string;
  consentMode: MctbConsentMode;
  automationActive: boolean;
  press1PlayUrl: string;
  voicemail: {
    kind: MctbVoicemailGreetingKind;
    playUrl: string;
  };
  warmedAt: number;
};

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const byE164 = new Map<string, { expires: number; profile: MctbInboundRoutingProfile }>();
const byToken = new Map<string, { expires: number; profile: MctbInboundRoutingProfile }>();

function e164Key(e164: string): string | null {
  const variants = mctbTexmlE164Variants(e164);
  return variants[0]?.replace(/\D/g, "") || null;
}

function routingTokenForPhone(phoneNumberId: string, e164: string): string {
  const digest = createHash("sha256")
    .update(`${phoneNumberId}:${e164}`)
    .digest("hex")
    .slice(0, 16);
  return `r_${digest}`;
}

/** Deterministic callback token from DID — no DB on ring. */
export function routingTokenForE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const digest = createHash("sha256")
    .update(`routing:e164:${digits}`)
    .digest("hex")
    .slice(0, 16);
  return `r_${digest}`;
}

export function platformPress1PlayUrl(): string {
  return getMctbConsentPlaybackUrl();
}

export function platformVoicemailPlayUrl(): string {
  return platformDefaultVoicemailUrl();
}

/** Fail-open voicemail — platform bundled asset when routing profile is cold. */
export function failOpenVoicemailPlayUrl(): string {
  const url = platformVoicemailPlayUrl();
  return url.startsWith("http") ? url : "";
}

function storeProfile(profile: MctbInboundRoutingProfile): void {
  const key = e164Key(profile.e164);
  if (!key) return;
  const entry = { expires: Date.now() + PROFILE_TTL_MS, profile };
  byE164.set(key, entry);
  byToken.set(profile.routingToken, entry);
}

export function peekMctbInboundRoutingProfileByE164(
  e164: string,
): MctbInboundRoutingProfile | null {
  const key = e164Key(e164);
  if (!key) return null;
  const hit = byE164.get(key);
  if (!hit || hit.expires <= Date.now()) return null;
  return hit.profile;
}

export function peekMctbInboundRoutingProfileByToken(
  token: string | null | undefined,
): MctbInboundRoutingProfile | null {
  const id = token?.trim();
  if (!id) return null;
  const hit = byToken.get(id);
  if (!hit || hit.expires <= Date.now()) return null;
  return hit.profile;
}

export function invalidateMctbInboundRoutingProfile(e164?: string): void {
  if (!e164) {
    byE164.clear();
    byToken.clear();
    return;
  }
  for (const variant of mctbTexmlE164Variants(e164)) {
    const key = variant.replace(/\D/g, "");
    const hit = byE164.get(key);
    if (hit) byToken.delete(hit.profile.routingToken);
    byE164.delete(key);
  }
}

/** Load routing profile from DB — setup/boot only (mode + callback tokens). Does not touch active.mp3. */
export async function warmMctbInboundRoutingProfileForE164(
  e164: string,
): Promise<MctbInboundRoutingProfile | null> {
  const { resolveMctbTexmlIngressConfig } = await import("./config-cache");
  const config = await resolveMctbTexmlIngressConfig(e164);
  if (!config) return null;

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();

  const phone = await prisma.phoneNumber.findFirst({
    where: { id: config.phoneNumberId, workspaceId: config.workspaceId },
    select: { id: true, e164: true, settingsJson: true },
  });
  if (!phone?.e164) return null;

  const settings = (phone.settingsJson || {}) as Record<string, unknown>;
  const storedInbound = (settings.mctbInbound || {}) as Record<string, unknown>;
  let routingToken = String(storedInbound.routingToken || "").trim();
  if (!routingToken) {
    routingToken = routingTokenForPhone(phone.id, phone.e164);
    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: {
        settingsJson: {
          ...settings,
          mctbInbound: {
            ...storedInbound,
            routingToken,
          },
        },
      },
    });
  }

  let greetingToken = String(storedInbound.greetingToken || "").trim();
  if (!greetingToken) {
    greetingToken = greetingTokenForE164(phone.e164);
  }

  const voicemailPlayUrl = resolveStableVoicemailGreetingPlayUrl(greetingToken);

  const { readIngressConsentAuthorityForPhone } = await import("@/lib/mctb/consent-mode-authority");
  const ws = await prisma.workspace.findUnique({
    where: { id: config.workspaceId },
    select: { customFieldsConfig: true },
  });
  const authority = await readIngressConsentAuthorityForPhone({
    workspaceId: config.workspaceId,
    phoneNumberId: phone.id,
    phoneSettingsJson: phone.settingsJson,
    workspaceCustomFieldsConfig: ws?.customFieldsConfig,
  });

  const profile: MctbInboundRoutingProfile = {
    routingToken,
    greetingToken,
    workspaceId: config.workspaceId,
    phoneNumberId: phone.id,
    e164: phone.e164,
    consentMode: authority.consentMode,
    automationActive: config.automationActive,
    press1PlayUrl: platformPress1PlayUrl(),
    voicemail: {
      kind: "platform_default",
      playUrl: voicemailPlayUrl,
    },
    warmedAt: Date.now(),
  };

  storeProfile(profile);
  return profile;
}

export async function warmMctbInboundRoutingProfileForWorkspace(
  workspaceId: string,
): Promise<void> {
  const { getPrisma } = await import("@/lib/db");
  const { loadMissedCallTextConfig } = await import("@/lib/agents/missed-call-text-back/config");
  const prisma = getPrisma();
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
    select: { e164: true, settingsJson: true },
  });
  for (const row of owned) {
    if (!row.e164) continue;
    const telephony = (row.settingsJson as Record<string, unknown>)?.telephony as
      | Record<string, unknown>
      | undefined;
    if (
      telephony?.routingMode === "mctb_texml" ||
      (row.settingsJson as Record<string, unknown>)?.routingOwner === "mctb_texml"
    ) {
      e164s.add(row.e164);
    }
  }

  await Promise.all([...e164s].map((e164) => warmMctbInboundRoutingProfileForE164(e164)));
}

/**
 * Resolve routing shell + authoritative consent for inbound TeXML (cache cannot decide consent).
 */
export async function resolveMctbInboundRoutingProfileForIngressCall(
  e164: string,
  routingTokenParam?: string | null,
): Promise<{
  profile: MctbInboundRoutingProfile | null;
  profileSource: "cache" | "persisted_load" | "unresolved";
}> {
  const cached =
    peekMctbInboundRoutingProfileByToken(routingTokenParam) ||
    peekMctbInboundRoutingProfileByE164(e164);
  const profileSource: "cache" | "persisted_load" | "unresolved" = cached
    ? "cache"
    : "persisted_load";
  const { resolveInboundRoutingProfileWithAuthoritativeConsent } = await import(
    "@/lib/mctb/consent-mode-authority"
  );
  const resolved = await resolveInboundRoutingProfileWithAuthoritativeConsent({
    e164,
    routingTokenParam,
    cachedProfile: cached,
    profileSource: cached ? "cache" : "persisted_load",
  });
  if (!resolved.profile) {
    return { profile: null, profileSource: "unresolved" };
  }
  return { profile: resolved.profile, profileSource };
}

/**
 * @deprecated Do not use for provisioned ingress — never substitutes Press 1 for config load failures.
 */
export function buildFailOpenInboundRoutingProfile(e164: string): MctbInboundRoutingProfile {
  return {
    routingToken: "r_unprovisioned",
    greetingToken: "g_unprovisioned",
    workspaceId: "",
    phoneNumberId: "",
    e164,
    consentMode: "press_1",
    automationActive: false,
    press1PlayUrl: platformPress1PlayUrl(),
    voicemail: {
      kind: "platform_default",
      playUrl: failOpenVoicemailPlayUrl(),
    },
    warmedAt: Date.now(),
  };
}

export function getMctbVoicemailRecordCallbackWithRoutingToken(
  routingToken: string,
): string {
  const base = getMctbTexmlVoicemailRecordCallbackUrl();
  const url = new URL(base);
  url.searchParams.set("r", routingToken);
  return url.toString();
}
