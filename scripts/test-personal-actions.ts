/**
 * Personal dashboard action contracts.
 * Run: npx tsx scripts/test-personal-actions.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const actions = read("src/lib/workspace/personal-number-actions.ts");
assert.ok(actions.includes("parkPersonalNumber"));
assert.ok(actions.includes("reactivatePersonalNumber"));
assert.ok(actions.includes("clearPortAwayWindow"));
assert.ok(actions.includes("loadPremiumCartCount"));

const api = read("src/app/api/personal/numbers/[numberId]/route.ts");
assert.ok(api.includes('"park"'));
assert.ok(api.includes('"reactivate"'));
assert.ok(api.includes("PERSONAL"));

const client = read("src/lib/personal/client-actions.ts");
assert.ok(client.includes("runPersonalNumberAction"));

const voicemail = read("src/lib/personal/voicemail-mappers.ts");
assert.ok(voicemail.includes("parseVoicemailApiPayload"));
assert.ok(voicemail.includes("fromE164"));

console.log("test-personal-actions: ok");
