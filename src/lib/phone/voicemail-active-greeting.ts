import "server-only";

import { access, copyFile, mkdir, readFile, rename } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { atomicWriteFile } from "@/lib/fs/atomic-write";
import { resolvePlatformVoicemailGreetingPlayUrl } from "@/lib/phone/voicemail-greeting-defaults";
import {
  absolutizePublicMediaUrl,
  smartRoutingAssetIdFromUrl,
} from "@/lib/phone/voicemail-greeting-playback";
import { readSmartRoutingAudioBytes } from "@/lib/smart-routing/media-service";

const ACTIVE_FILENAME = "active.mp3";
const MIN_GREETING_BYTES = 256;

/** Voicemail greeting files — written only on Save (provisionActiveVoicemailGreeting). */
export function voicemailGreetingsRoot(): string {
  return (
    process.env.VOICEMAIL_GREETINGS_DIR?.trim() ||
    path.join(process.cwd(), "public", "voicemail")
  );
}

function greetingDir(greetingToken: string): string {
  return path.join(voicemailGreetingsRoot(), greetingToken);
}

function activeMp3Path(greetingToken: string): string {
  return path.join(greetingDir(greetingToken), ACTIVE_FILENAME);
}

function newTmpPath(greetingToken: string): string {
  return path.join(greetingDir(greetingToken), "new.tmp");
}

function appBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    ""
  );
}

/** Opaque per-phone token — not workspace/phone IDs in the public URL. */
export function greetingTokenForPhone(phoneNumberId: string, e164: string): string {
  const digest = createHash("sha256")
    .update(`greeting:${phoneNumberId}:${e164}`)
    .digest("hex")
    .slice(0, 16);
  return `g_${digest}`;
}

/**
 * Stable carrier-facing URL — never changes; file content swapped at Save time.
 * Live path: GET /voicemail/g_xxx/active.mp3 (static, no app code).
 */
export function resolveStableVoicemailGreetingPlayUrl(greetingToken: string): string {
  const base = appBaseUrl();
  const pathPart = `/voicemail/${greetingToken}/${ACTIVE_FILENAME}`;
  return base ? `${base}${pathPart}` : pathPart;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPlatformDefaultBytes(): Promise<Buffer | null> {
  const { resolvePlatformVoicemailGreetingAssetId } = await import(
    "@/lib/phone/voicemail-greeting-defaults"
  );
  const assetId = resolvePlatformVoicemailGreetingAssetId();
  const bundled = await readSmartRoutingAudioBytes(assetId);
  return bundled?.bytes ?? null;
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

  const localPath = raw.startsWith("/") ? path.join(process.cwd(), "public", raw.slice(1)) : raw;
  if (await fileExists(localPath)) {
    return readFile(localPath);
  }

  void workspaceId;
  return null;
}

function validateGreetingBytes(bytes: Buffer): void {
  if (bytes.length < MIN_GREETING_BYTES) {
    throw new Error(`voicemail greeting too small (${bytes.length} bytes)`);
  }
}

/**
 * Atomic active.mp3 swap at configuration time:
 *   new.tmp → validate → archive current active → rename tmp → active.mp3
 * POSIX rename(tmp, active) atomically replaces active when both exist.
 */
async function atomicSwapActiveMp3(greetingToken: string, newBytes: Buffer): Promise<void> {
  validateGreetingBytes(newBytes);
  const dir = greetingDir(greetingToken);
  await mkdir(dir, { recursive: true });

  const activePath = activeMp3Path(greetingToken);
  const tmpPath = newTmpPath(greetingToken);

  await atomicWriteFile(tmpPath, newBytes);

  if (await fileExists(activePath)) {
    const archivePath = path.join(dir, `archive-${Date.now()}.mp3`);
    await copyFile(activePath, archivePath);
    await rename(activePath, path.join(dir, "previous.mp3"));
  }

  await rename(tmpPath, activePath);
}

/**
 * Save-time only — swaps active.mp3 on disk. Never called on ring or boot warm.
 */
export async function provisionActiveVoicemailGreeting(input: {
  greetingToken: string;
  workspaceId: string;
  greetingUrl: string | null | undefined;
}): Promise<{ playUrl: string; kind: "platform" | "custom" }> {
  const playUrl = resolveStableVoicemailGreetingPlayUrl(input.greetingToken);
  const customBytes = await resolveGreetingSourceBytes(input.greetingUrl, input.workspaceId);
  const bytes = customBytes?.length ? customBytes : await readPlatformDefaultBytes();

  if (!bytes?.length) {
    throw new Error("could not resolve voicemail greeting audio");
  }

  await atomicSwapActiveMp3(input.greetingToken, bytes);
  return {
    playUrl,
    kind: customBytes?.length ? "custom" : "platform",
  };
}

/** Test/health helper — live calls hit static active.mp3 directly. */
export async function readActiveVoicemailGreetingBytes(
  greetingToken: string,
): Promise<{ bytes: Buffer; mimeType: string; source: "platform" | "custom" | "missing" }> {
  const activePath = activeMp3Path(greetingToken);
  if (await fileExists(activePath)) {
    return {
      bytes: await readFile(activePath),
      mimeType: "audio/mpeg",
      source: "custom",
    };
  }

  const platform = await readPlatformDefaultBytes();
  if (platform) {
    return { bytes: platform, mimeType: "audio/mpeg", source: "platform" };
  }

  return { bytes: Buffer.alloc(0), mimeType: "audio/mpeg", source: "missing" };
}

/** Re-export for routing-profile fail-open when active.mp3 not yet provisioned. */
export function platformVoicemailGreetingPlayUrl(): string {
  return resolvePlatformVoicemailGreetingPlayUrl();
}
