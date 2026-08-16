#!/usr/bin/env node
/**
 * Verify TRANSOVO_BACKEND_URL serves transovo-web before voice deploy.
 * Usage: TRANSOVO_BACKEND_URL=https://your-domain node scripts/probe-transovo-backend-url.mjs
 */
// pragma: allowlist secret
const base = (process.env.TRANSOVO_BACKEND_URL || "").replace(/\/$/, "");

if (!base) {
  console.error("Set TRANSOVO_BACKEND_URL to your transovo-web public URL");
  process.exit(1);
}

async function probe(path) {
  const url = `${base}${path}`;
  const res = await fetch(url);
  const text = await res.text();
  return { url, status: res.status, body: text.slice(0, 300) };
}

const health = await probe("/api/health");
const internal = await probe("/api/internal/voice-runtime");

console.log(JSON.stringify({ base, health, internal }, null, 2));

if (health.status !== 200) {
  console.error(
    `\nFAIL: ${base}/api/health returned ${health.status}. transovo-web is not healthy at this URL.`,
  );
  console.error("Fix transovo-web Coolify app or point TRANSOVO_BACKEND_URL to the working domain.");
  process.exit(1);
}

if (internal.status !== 200) {
  console.error(
    `\nWARN: ${base}/api/internal/voice-runtime GET returned ${internal.status} (expected 200 JSON probe).`,
  );
  process.exit(1);
}

console.log("\nOK: backend URL is reachable for voice worker.");
