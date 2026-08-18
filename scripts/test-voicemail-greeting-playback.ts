/**
 * Hermetic helpers for voicemail ElevenLabs greeting URL resolution.
 * Run: npx tsx scripts/test-voicemail-greeting-playback.ts
 */
import assert from "node:assert/strict";

function smartRoutingAssetIdFromUrl(url: string): string | null {
  const match = url.match(/smart-routing-audio\/([a-z0-9]+)/i);
  return match?.[1] ?? null;
}

function absolutizePublicMediaUrl(
  url: string | null | undefined,
  appUrl: string,
): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = appUrl.replace(/\/$/, "");
  if (!base || base.includes("localhost")) return null;
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

assert.equal(
  smartRoutingAssetIdFromUrl("https://app.example.com/api/public/smart-routing-audio/abc123"),
  "abc123",
);
assert.equal(
  absolutizePublicMediaUrl("/api/public/smart-routing-audio/abc123", "https://app.example.com"),
  "https://app.example.com/api/public/smart-routing-audio/abc123",
);
assert.equal(absolutizePublicMediaUrl("https://cdn.example.com/g.mp3", "https://app.example.com"), "https://cdn.example.com/g.mp3");
assert.equal(absolutizePublicMediaUrl("/api/public/foo", "http://localhost:3000"), null);

console.log("test-voicemail-greeting-playback: ok");
