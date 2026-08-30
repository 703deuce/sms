import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_CACHE_DIR } from "./config";

export type KimiFileCacheEntry = {
  referenceName: string;
  supabaseBucket: string;
  supabasePath: string;
  size: number;
  sha256: string;
  kimi: {
    fileId: string;
    uri: string;
    status: string;
    uploadedAt: string;
    lastVerifiedAt: string;
  };
};

type KimiFileCacheManifest = Record<string, KimiFileCacheEntry>;

const CACHE_PATH = join(UI_AGENT_CACHE_DIR, "kimi-file-ids.json");

function cacheKey(bucket: string, path: string): string {
  return `${bucket}:${path}`;
}

function readManifest(): KimiFileCacheManifest {
  if (!existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_PATH, "utf8")) as KimiFileCacheManifest;
  } catch {
    return {};
  }
}

function writeManifest(manifest: KimiFileCacheManifest): void {
  mkdirSync(UI_AGENT_CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(manifest, null, 2), "utf8");
}

export function sha256Buffer(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function lookupKimiFileCache(input: {
  bucket: string;
  path: string;
  size?: number;
  sha256?: string;
}): KimiFileCacheEntry | null {
  const entry = readManifest()[cacheKey(input.bucket, input.path)];
  if (!entry) return null;
  if (input.size != null && entry.size !== input.size) return null;
  if (input.sha256 && entry.sha256 !== input.sha256) return null;
  return entry;
}

export function saveKimiFileCache(entry: KimiFileCacheEntry): void {
  const manifest = readManifest();
  manifest[cacheKey(entry.supabaseBucket, entry.supabasePath)] = entry;
  writeManifest(manifest);
}

export function invalidateKimiFileCache(bucket: string, path: string): void {
  const manifest = readManifest();
  delete manifest[cacheKey(bucket, path)];
  writeManifest(manifest);
}

export function touchKimiFileCacheVerified(bucket: string, path: string): void {
  const manifest = readManifest();
  const key = cacheKey(bucket, path);
  const entry = manifest[key];
  if (!entry) return;
  entry.kimi.lastVerifiedAt = new Date().toISOString();
  manifest[key] = entry;
  writeManifest(manifest);
}
