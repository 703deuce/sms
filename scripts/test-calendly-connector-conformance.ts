#!/usr/bin/env tsx
/**
 * Mechanical Calendly connector conformance (rulebook CAL-ARCH-001).
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { CALENDLY_OAUTH_SCOPES } from "../src/lib/integrations/adapters/calendly";
import {
  buildCalendlyAvailabilityRequest,
  CALENDLY_MAX_AVAILABILITY_WINDOW_MS,
} from "../src/lib/integrations/adapters/calendly-client";

const ROOT = process.cwd();
const ALLOWED_RAW_PREFIXES = [
  "src/lib/integrations/adapters/calendly",
  "src/lib/integrations/framework/diagnostics.ts",
  "voice-runtime/",
  "scripts/test-",
];

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === "node_modules" || name === ".git") continue;
    const st = statSync(p);
    if (st.isDirectory()) walkTs(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

const rawHits: string[] = [];
for (const file of walkTs(path.join(ROOT, "src"))) {
  const rel = file.replace(ROOT + path.sep, "");
  if (ALLOWED_RAW_PREFIXES.some((prefix) => rel.startsWith(prefix) || rel === prefix)) continue;
  const text = readFileSync(file, "utf8");
  if (text.includes("api.calendly.com")) rawHits.push(rel);
}

assert.equal(rawHits.length, 0, `UNAPPROVED_RAW_CALENDLY_CALLS: ${rawHits.join(", ")}`);

assert.ok(CALENDLY_OAUTH_SCOPES.includes("availability:read"));
assert.ok(CALENDLY_OAUTH_SCOPES.includes("scheduled_events:write"));

const built = buildCalendlyAvailabilityRequest({
  eventTypeUri: "https://api.calendly.com/event_types/abc",
  startTimeIso: "2026-09-15T12:00:00.000Z",
  endTimeIso: "2026-10-20T12:00:00.000Z",
});
assert.ok(built.chunks && built.chunks.length > 1, "31d+ window must chunk");

const span = new Date("2026-09-16T12:00:00.000Z").getTime() - new Date("2026-09-15T12:00:00.000Z").getTime();
assert.ok(span < CALENDLY_MAX_AVAILABILITY_WINDOW_MS);

const router = readFileSync("src/lib/mctb/ai-booking/agents/router.ts", "utf8");
assert.ok(!router.includes("api.calendly.com"));

const oauth = readFileSync("src/lib/integrations/framework/oauth.ts", "utf8");
assert.ok(oauth.includes("withIntegrationTokenRefreshLock"));

const webhook = readFileSync("src/lib/integrations/adapters/calendly.ts", "utf8");
assert.ok(webhook.includes("p.rescheduled ? \"appointment.rescheduled\""));

console.log("test-calendly-connector-conformance: OK");
