import "server-only";

import { createHash } from "crypto";
import { resolvePlatformVoicemailGreetingPlayUrl } from "@/lib/phone/voicemail-greeting-defaults";
import {
  absolutizePublicMediaUrl,
  smartRoutingAssetIdFromUrl,
} from "@/lib/phone/voicemail-greeting-playback";
import { readSmartRoutingAudioBytes } from "@/lib/smart-routing/media-service";
import {
  readVoicemailActiveMp3Bytes,
  resolveDurableVoicemailActivePublicUrl,
  resolveLocalVoicemailActivePublicUrl,
  writeVoicemailActiveMp3,
} from "@/lib/phone/voicemail-greeting-storage";

const ACTIVE_FILENAME = "active.mp3";

function appBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    ""
  );
}

/** Opaque per-DID token — derived from E164 only (no DB needed on ring). */
export function greetingTokenForE164(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  const digest = createHash("sha256")
    .update(`greeting:e164:${digits}`)
    .digest("hex")
    .slice(0, 16);
  return `g_${digest}`;
}

/** @deprecated Use greetingTokenForE164 — token is per-DID, not per internal phone row id. */
export function greetingTokenForPhone(_phoneNumberId: string, e164: string): string {
  return greetingTokenForE164(e164);
}

/**
 * Stable carrier-facing URL — never changes; object/file content swapped on Save only.
 * Supabase public URL when configured; else local /voicemail/.../active.mp3.
 */
export function resolveStableVoicemailGreetingPlayUrl(greetingToken: string): string {
  const durable = resolveDurableVoicemailActivePublicUrl(greetingToken);
  if (durable) return durable;
  const base = appBaseUrl();
  return resolveLocalVoicemailActivePublicUrl(greetingToken, base || "http://localhost");
}

async function resolveGreetingSourceBytes(
  greetingUrl: string | null | undefined,
  workspaceId: string,
): Promise<Buffer | null> {
  const raw = greetingUrl?.trim();
  if (!raw) return null;

  const assetId = smartRoutingAssetIdFromUrl(raw);
  if (assetId) {
    const fromAsset = await readSmartRoutingAudioBytes(assetId);
    if (fromAsset) return fromAsset.bytes;
  }

  const absolute = /^https?:\/\//i.test(raw) ? raw : absolutizePublicMediaUrl(raw);
  if (absolute?.startsWith("http")) {
    try {
      const res = await fetch(absolute, { signal: AbortSignal.timeout(15_000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  void workspaceId;
  return null;
}

async function readPlatformDefaultBytes(): Promise<Buffer | null> {
  const { resolvePlatformVoicemailGreetingAssetId } = await import(
    "@/lib/phone/voicemail-greeting-defaults"
  );
  const assetId = resolvePlatformVoicemailGreetingAssetId();
  const bundled = await readSmartRoutingAudioBytes(assetId);
  return bundled?.bytes ?? null;
}

/**
 * Save-time only — atomically replaces active.mp3 in durable storage (Supabase or disk).
 */
export async function provisionActiveVoicemailGreeting(input: {
  greetingToken: string;
  workspaceId: string;
  greetingUrl: string | null | undefined;
  e164?: string;
}): Promise<{ playUrl: string; kind: "platform" | "custom"; storage: "supabase" | "disk" }> {
  const token =
    input.greetingToken?.trim() ||
    (input.e164 ? greetingTokenForE164(input.e164) : "");
  if (!token) throw new Error("greetingToken or e164 required");

  const customBytes = await resolveGreetingSourceBytes(input.greetingUrl, input.workspaceId);
  const bytes = customBytes?.length ? customBytes : await readPlatformDefaultBytes();
  if (!bytes?.length) throw new Error("could not resolve voicemail greeting audio");

  const written = await writeVoicemailActiveMp3({ greetingToken: token, bytes });
  return {
    playUrl: written.publicUrl,
    kind: customBytes?.length ? "custom" : "platform",
    storage: written.storage,
  };
}

/** Test/health helper — not used on live call path (carrier hits public URL directly). */
export async function readActiveVoicemailGreetingBytes(
  greetingToken: string,
): Promise<{ bytes: Buffer; mimeType: string; source: "active" | "platform" | "missing" }> {
  const active = await readVoicemailActiveMp3Bytes(greetingToken);
  if (active?.length) {
    return { bytes: active, mimeType: "audio/mpeg", source: "active" };
  }

  const platform = await readPlatformDefaultBytes();
  if (platform) {
    return { bytes: platform, mimeType: "audio/mpeg", source: "platform" };
  }

  return { bytes: Buffer.alloc(0), mimeType: "audio/mpeg", source: "missing" };
}

export function platformVoicemailGreetingPlayUrl(): string {
  return resolvePlatformVoicemailGreetingPlayUrl();
}

/**
 * Carriers fetch stable active.mp3 directly — seed platform audio when missing so new boxes work without a custom save.
 */
export async function seedStableVoicemailGreetingIfMissing(input: {
  greetingToken: string;
  workspaceId: string;
  greetingUrl: string | null | undefined;
  e164?: string;
}): Promise<void> {
  const token =
    input.greetingToken?.trim() ||
    (input.e164 ? greetingTokenForE164(input.e164) : "");
  if (!token) return;

  const existing = await readVoicemailActiveMp3Bytes(token);
  if (existing?.length) return;

  await provisionActiveVoicemailGreeting({
    greetingToken: token,
    workspaceId: input.workspaceId,
    greetingUrl: input.greetingUrl,
    e164: input.e164,
  });
}

export async function syncVoicemailActiveGreetingForPhoneNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
  greetingUrl?: string | null;
}): Promise<void> {
  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const phone = await prisma.phoneNumber.findFirst({
    where: { id: input.phoneNumberId, workspaceId: input.workspaceId },
    select: { e164: true },
  });
  if (!phone?.e164) return;

  let greetingUrl = input.greetingUrl;
  if (greetingUrl === undefined) {
    const box = await prisma.voicemailBox.findFirst({
      where: { workspaceId: input.workspaceId, phoneNumberId: input.phoneNumberId },
      select: { greetingUrl: true },
    });
    greetingUrl = box?.greetingUrl ?? null;
  }

  const greetingToken = greetingTokenForE164(phone.e164);
  await provisionActiveVoicemailGreeting({
    greetingToken,
    workspaceId: input.workspaceId,
    greetingUrl,
    e164: phone.e164,
  });
}

export { ACTIVE_FILENAME };
