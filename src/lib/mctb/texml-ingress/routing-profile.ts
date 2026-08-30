import "server-only";

import { createHash } from "crypto";
import type { MctbConsentMode } from "@/lib/mctb/consent-mode";
import { getMctbConsentPlaybackUrl, getMctbTexmlVoicemailRecordCallbackUrl } from "@/lib/mctb/consent-prompt/texml-response";
import {
  platformVoicemailGreetingPlayUrl as platformDefaultVoicemailUrl,
  provisionActiveVoicemailGreeting,
} from "@/lib/phone/voicemail-active-greeting";
import { mctbTexmlE164Variants } from "./e164-lookup";

export type MctbVoicemailGreetingKind = "platform_default" | "custom";

export type MctbInboundRoutingProfile = {
  routingToken: string;
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

export function platformPress1PlayUrl(): string {
  return getMctbConsentPlaybackUrl();
}

export function platformVoicemailPlayUrl(): string {
  return platformDefaultVoicemailUrl();
}

/** Fail-open voicemail URL — platform default smart-routing asset (not stable /active). */
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

/** Setup-time resolution — provisions versioned active greeting, returns stable play URL. */
export async function resolveProvisionedVoicemailPlayUrl(input: {
  workspaceId: string;
  phoneNumberId: string;
  greetingUrl: string | null | undefined;
}): Promise<{ kind: MctbVoicemailGreetingKind; playUrl: string }> {
  const provisioned = await provisionActiveVoicemailGreeting({
    workspaceId: input.workspaceId,
    phoneNumberId: input.phoneNumberId,
    greetingUrl: input.greetingUrl,
  });
  return {
    kind: provisioned.kind === "custom" ? "custom" : "platform_default",
    playUrl: provisioned.playUrl,
  };
}

/** Load routing profile from DB — call at setup/provision/boot only, never on ring. */
export async function warmMctbInboundRoutingProfileForE164(
  e164: string,
): Promise<MctbInboundRoutingProfile | null> {
  const { resolveMctbTexmlIngressConfig } = await import("./config-cache");
  const config = await resolveMctbTexmlIngressConfig(e164);
  if (!config) return null;

  const { getPrisma } = await import("@/lib/db");
  const { ensureNumberVoicemailBox } = await import("@/lib/phone/voicemail-service");
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

  const box = await ensureNumberVoicemailBox(config.workspaceId, phone.id).catch(() => null);
  const voicemail = await resolveProvisionedVoicemailPlayUrl({
    workspaceId: config.workspaceId,
    phoneNumberId: phone.id,
    greetingUrl: box?.greetingUrl ?? null,
  });

  const profile: MctbInboundRoutingProfile = {
    routingToken,
    workspaceId: config.workspaceId,
    phoneNumberId: phone.id,
    e164: phone.e164,
    consentMode: config.consentMode,
    automationActive: config.automationActive,
    press1PlayUrl: platformPress1PlayUrl(),
    voicemail,
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

/** Synchronous fail-open profile when cache is cold — platform audio only. */
export function buildFailOpenInboundRoutingProfile(e164: string): MctbInboundRoutingProfile {
  return {
    routingToken: "r_failopen",
    workspaceId: "",
    phoneNumberId: "",
    e164,
    consentMode: "press_1",
    automationActive: true,
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
