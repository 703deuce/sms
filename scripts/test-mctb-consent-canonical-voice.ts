/**
 * MCTB consent publish must never activate legacy Smart Routing voice flows.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-consent-canonical-voice.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const servicePath = join(process.cwd(), "src/lib/mctb/consent-prompt/service.ts");
const source = readFileSync(servicePath, "utf8");

assert.doesNotMatch(source, /await publishFlow\(/, "MCTB consent must not publish Smart Routing flows");
assert.doesNotMatch(source, /await createFlow\(/, "MCTB consent must not create Smart Routing flows");
assert.match(source, /provisionMctbTelnyxSipIngress/, "MCTB consent must provision Call Control ingress");
assert.match(source, /pauseLegacyMctbConsentFlows/, "MCTB consent must pause legacy SR flows");

console.log("test-mctb-consent-canonical-voice: ok");
