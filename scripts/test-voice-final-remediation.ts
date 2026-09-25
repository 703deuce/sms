/**
 * Lightweight checks for Voice final controlled remediation (webhooks + nav).
 * Run: npx tsx scripts/test-voice-final-remediation.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  VOICE_WEBHOOK_EVENT_TYPES,
  VOICE_WEBHOOK_SUBSCRIPTION_EVENT_TYPES,
} from "../src/lib/voice-v3/webhooks/events";
import { signWebhookPayload } from "../src/lib/voice-v3/webhooks/signing";
import { legacyVoiceAgentPageRedirect } from "../src/lib/voice/legacy-agent-route";
import { buildAiAfterHoursNav } from "../src/lib/products/ai-after-hours-nav";

const root = join(process.cwd());

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

// Event catalog
assert.deepEqual(
  VOICE_WEBHOOK_SUBSCRIPTION_EVENT_TYPES,
  VOICE_WEBHOOK_EVENT_TYPES.filter((t) => t !== "voice.test"),
);
assert.ok(VOICE_WEBHOOK_EVENT_TYPES.includes("voice.transfer.connected"));
assert.ok(!VOICE_WEBHOOK_EVENT_TYPES.includes("voice.transfer.completed"));

// Worker wiring
const jobHandlers = read("src/lib/jobs/job-handlers.ts");
assert.match(jobHandlers, /case "voice_webhook_deliver"/);
assert.match(jobHandlers, /executeVoiceWebhookDeliverJob/);

// Signing contract
const delivery = read("src/lib/voice-v3/webhooks/delivery.ts");
assert.match(delivery, /X-Transovo-Signature/);
assert.match(delivery, /X-Transovo-Event-Id/);
assert.match(delivery, /X-Transovo-Event-Type/);
assert.match(delivery, /X-Transovo-Timestamp/);
const body = JSON.stringify({ id: "evt_test", type: "voice.test" });
const sig = signWebhookPayload("test-secret", "123", body);
assert.equal(typeof sig, "string");
assert.ok(sig.length > 10);

// Outbound API + SSRF helper
assert.match(read("src/app/api/integrations/webhooks/voice/route.ts"), /requireSession/);
assert.match(read("src/lib/voice-v3/webhooks/outbound.ts"), /assertSafeWebhookUrl/);

// Incoming webhook route unchanged shape
assert.match(read("src/app/api/integrations/webhooks/route.ts"), /createIntegrationWebhook/);

// UI separation
const panel = read("src/components/integrations/webhooks-panel.tsx");
assert.match(panel, /Outbound webhooks/);
assert.match(panel, /Incoming webhooks/);

// Legacy agent redirects
assert.equal(legacyVoiceAgentPageRedirect("/voice/agents/abc/integrations"), "/integrations");
assert.equal(legacyVoiceAgentPageRedirect("/voice/agents/abc/about"), "/voice/receptionist");
assert.match(read("src/app/(app)/voice/agents/page.tsx"), /redirect\("\/voice\/receptionist"\)/);

// Nav: no permanent Agents / inbound-routing in AI After Hours nav
const nav = buildAiAfterHoursNav();
const hrefs = nav.flatMap((item) => [
  item.href,
  ...(item.children?.map((c) => c.href) ?? []),
]);
assert.ok(!hrefs.some((h) => h === "/voice/agents" || h?.startsWith("/voice/agents/")));
assert.ok(!hrefs.includes("/voice/inbound-routing"));
assert.ok(hrefs.includes("/voice/receptionist"));
assert.ok(hrefs.includes("/voice/call-handling"));

// Inbound routing compatibility redirect
assert.match(read("src/app/(app)/voice/inbound-routing/page.tsx"), /\/voice\/call-handling/);

// Digest stale claim
const registry = read("src/lib/outcomes/registry.ts");
assert.ok(!registry.includes("Morning digest summary"));

console.log("test-voice-final-remediation: PASS");
