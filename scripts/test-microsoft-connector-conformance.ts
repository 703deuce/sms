#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
const MICROSOFT_PERSONAL_ACCOUNT_TENANT_ID = "9188040d-6c67-4c5b-b112-36a304b66dad";
function inferMicrosoftAccountType(tenantId?: string | null) {
  if (!tenantId) return "unknown";
  if (tenantId.toLowerCase() === MICROSOFT_PERSONAL_ACCOUNT_TENANT_ID) return "personal";
  return "organizational";
}
function canUseMicrosoftGetSchedule(accountType?: string | null) {
  return accountType === "organizational";
}

const ROOT = process.cwd();
const ALLOWED_GRAPH_PREFIXES = [
  "src/lib/calendar/",
  "src/lib/microsoft/",
  "src/lib/voice/calendar/providers.ts",
];

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === "node_modules" || name === ".git") continue;
    const st = statSync(p);
    if (st.isDirectory()) walkTs(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const rawHits: string[] = [];
for (const file of walkTs(path.join(ROOT, "src"))) {
  const rel = file.replace(ROOT + path.sep, "");
  if (ALLOWED_GRAPH_PREFIXES.some((prefix) => rel.startsWith(prefix) || rel === prefix)) continue;
  const text = readFileSync(file, "utf8");
  if (text.includes("graph.microsoft.com")) rawHits.push(rel);
}

assert.equal(rawHits.length, 0, `UNAPPROVED_RAW_GRAPH_CALENDAR_CALLS: ${rawHits.join(", ")}`);

const oauthCfg = readFileSync("src/lib/microsoft/oauth-config.ts", "utf8");
assert.ok(oauthCfg.includes("offline_access"));
assert.ok(oauthCfg.includes("Calendars.ReadWrite"));

assert.equal(inferMicrosoftAccountType(MICROSOFT_PERSONAL_ACCOUNT_TENANT_ID), "personal");
assert.equal(canUseMicrosoftGetSchedule("personal"), false);
assert.equal(canUseMicrosoftGetSchedule("organizational"), true);

const providers = readFileSync("src/lib/calendar/providers.ts", "utf8");
assert.ok(providers.includes("microsoftGraphFetch"));
assert.ok(providers.includes("getMicrosoftBusyViaGetSchedule"));
assert.ok(providers.includes("getMicrosoftBusyViaCalendarView"));
assert.ok(providers.includes("transactionId"));

const mctb = readFileSync("src/lib/mctb/ai-booking/providers/microsoft.ts", "utf8");
assert.ok(mctb.includes("prepareMicrosoftBooking"));
assert.ok(!mctb.includes("graph.microsoft.com"));

const agents = readFileSync("src/lib/mctb/ai-booking/agents/router.ts", "utf8");
assert.ok(!agents.includes("getMicrosoftBusy"));

console.log("test-microsoft-connector-conformance: OK");
