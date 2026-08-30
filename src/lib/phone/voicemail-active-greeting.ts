import "server-only";

import { access, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { resolvePlatformVoicemailGreetingPlayUrl } from "@/lib/phone/voicemail-greeting-defaults";
import {
  absolutizePublicMediaUrl,
  smartRoutingAssetIdFromUrl,
} from "@/lib/phone/voicemail-greeting-playback";
import { readSmartRoutingAudioBytes } from "@/lib/smart-routing/media-service";

const GREETINGS_ROOT = () => path.join(process.cwd(), "public", "voicemail-greetings");

export type VoicemailActivePointer =
  | { kind: "platform" }
  | { kind: "version"; version: number };

type ActiveCacheEntry = { pointer: VoicemailActivePointer; expires: number };

const ACTIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const activePointerCache = new Map<string, ActiveCacheEntry>();

function cacheKey(workspaceId: string, phoneNumberId: string): string {
  return `${workspaceId}:${phoneNumberId}`;
}

function greetingDir(workspaceId: string, phoneNumberId: string): string {
  return path.join(GREETINGS_ROOT(), workspaceId, phoneNumberId);
}

function activePointerPath(workspaceId: string, phoneNumberId: string): string {
  return path.join(greetingDir(workspaceId, phoneNumberId), "active.json");
}

function versionedPath(workspaceId: string, phoneNumberId: string, version: number): string {
  return path.join(greetingDir(workspaceId, phoneNumberId), `v${version}.mp3`);
}

function appBaseUrl(): string {
  return (
    process.env.APP_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    ""
  );
}

/** Stable carrier-facing URL — never changes; content updated at configuration time. */
export function resolveStableVoicemailGreetingPlayUrl(
  workspaceId: string,
  phoneNumberId: string,
): string {
  const base = appBaseUrl();
  const pathPart = `/api/public/greetings/${encodeURIComponent(workspaceId)}/${encodeURIComponent(phoneNumberId)}/active`;
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

function storeActivePointerCache(
  workspaceId: string,
  phoneNumberId: string,
  pointer: VoicemailActivePointer,
): void {
  activePointerCache.set(cacheKey(workspaceId, phoneNumberId), {
    pointer,
    expires: Date.now() + ACTIVE_CACHE_TTL_MS,
  });
}

export function peekActiveVoicemailPointer(
  workspaceId: string,
  phoneNumberId: string,
): VoicemailActivePointer | null {
  const hit = activePointerCache.get(cacheKey(workspaceId, phoneNumberId));
  if (!hit || hit.expires <= Date.now()) return null;
  return hit.pointer;
}

async function readActivePointerFromDisk(
  workspaceId: string,
  phoneNumberId: string,
): Promise<VoicemailActivePointer | null> {
  const pointerFile = activePointerPath(workspaceId, phoneNumberId);
  if (!(await fileExists(pointerFile))) return null;
  try {
    const raw = JSON.parse(await readFile(pointerFile, "utf8")) as VoicemailActivePointer;
    if (raw.kind === "platform") return { kind: "platform" };
    if (raw.kind === "version" && typeof raw.version === "number" && raw.version > 0) {
      return { kind: "version", version: raw.version };
    }
  } catch {
    return null;
  }
  return null;
}

async function resolveActivePointer(
  workspaceId: string,
  phoneNumberId: string,
): Promise<VoicemailActivePointer> {
  const cached = peekActiveVoicemailPointer(workspaceId, phoneNumberId);
  if (cached) return cached;

  const fromDisk = await readActivePointerFromDisk(workspaceId, phoneNumberId);
  if (fromDisk) {
    storeActivePointerCache(workspaceId, phoneNumberId, fromDisk);
    return fromDisk;
  }
  return { kind: "platform" };
}

async function readPlatformDefaultBytes(): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const { resolvePlatformVoicemailGreetingAssetId } = await import(
    "@/lib/phone/voicemail-greeting-defaults"
  );
  const assetId = resolvePlatformVoicemailGreetingAssetId();
  const bundled = await readSmartRoutingAudioBytes(assetId);
  if (!bundled) return null;
  return bundled;
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

async function writeActivePointer(
  workspaceId: string,
  phoneNumberId: string,
  pointer: VoicemailActivePointer,
): Promise<void> {
  const dir = greetingDir(workspaceId, phoneNumberId);
  await mkdir(dir, { recursive: true });
  await writeFile(activePointerPath(workspaceId, phoneNumberId), JSON.stringify(pointer));
  storeActivePointerCache(workspaceId, phoneNumberId, pointer);
}

/**
 * Configuration-time: resolve custom/default, store versioned audio, update active pointer.
 * Call on voicemail save and during routing warm — never on ring.
 */
export async function provisionActiveVoicemailGreeting(input: {
  workspaceId: string;
  phoneNumberId: string;
  greetingUrl: string | null | undefined;
}): Promise<{ playUrl: string; kind: "platform" | "custom" }> {
  const playUrl = resolveStableVoicemailGreetingPlayUrl(input.workspaceId, input.phoneNumberId);
  const sourceBytes = await resolveGreetingSourceBytes(input.greetingUrl, input.workspaceId);

  if (!sourceBytes?.length) {
    await writeActivePointer(input.workspaceId, input.phoneNumberId, { kind: "platform" });
    return { playUrl, kind: "platform" };
  }

  const existing = await readActivePointerFromDisk(input.workspaceId, input.phoneNumberId);
  const nextVersion =
    existing?.kind === "version" ? existing.version + 1 : 1;
  const versionPath = versionedPath(input.workspaceId, input.phoneNumberId, nextVersion);
  await mkdir(greetingDir(input.workspaceId, input.phoneNumberId), { recursive: true });
  await writeFile(versionPath, sourceBytes);
  await writeActivePointer(input.workspaceId, input.phoneNumberId, {
    kind: "version",
    version: nextVersion,
  });
  return { playUrl, kind: "custom" };
}

/** Synchronous-friendly read for public route — no Postgres. Fails open to platform default. */
export async function readActiveVoicemailGreetingBytes(
  workspaceId: string,
  phoneNumberId: string,
): Promise<{ bytes: Buffer; mimeType: string; source: "platform" | "custom" }> {
  const pointer = await resolveActivePointer(workspaceId, phoneNumberId);

  if (pointer.kind === "version") {
    const versionPath = versionedPath(workspaceId, phoneNumberId, pointer.version);
    if (await fileExists(versionPath)) {
      return {
        bytes: await readFile(versionPath),
        mimeType: "audio/mpeg",
        source: "custom",
      };
    }
  }

  const platform = await readPlatformDefaultBytes();
  if (platform) {
    return { ...platform, source: "platform" };
  }

  return {
    bytes: Buffer.alloc(0),
    mimeType: "audio/mpeg",
    source: "platform",
  };
}

export function invalidateActiveVoicemailGreetingCache(
  workspaceId?: string,
  phoneNumberId?: string,
): void {
  if (!workspaceId) {
    activePointerCache.clear();
    return;
  }
  if (phoneNumberId) {
    activePointerCache.delete(cacheKey(workspaceId, phoneNumberId));
    return;
  }
  for (const key of activePointerCache.keys()) {
    if (key.startsWith(`${workspaceId}:`)) activePointerCache.delete(key);
  }
}

/** Re-export for routing-profile fail-open. */
export function platformVoicemailGreetingPlayUrl(): string {
  return resolvePlatformVoicemailGreetingPlayUrl();
}
