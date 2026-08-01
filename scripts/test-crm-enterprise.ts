/**
 * CRM enterprise unit/contract tests (no live CRM required).
 * Run: npx tsx scripts/test-crm-enterprise.ts
 */

import assert from "node:assert/strict";
import {
  crmEventIdempotencyKey,
  crmWriteIdempotencyKey,
  payloadSyncHash,
} from "../src/lib/crm/idempotency";
import { applyFieldMappingsOutbound } from "../src/lib/crm/mappings";
import {
  featureSupport,
  isFeatureSupported,
  isSandboxProven,
} from "../src/lib/crm/feature-matrix";
import { supportLabel } from "../src/lib/crm/capability";
import { DEFAULT_SYNC_PREFERENCES } from "../src/lib/crm/types";
import { clampPreferencesToCapabilities } from "../src/lib/crm/capability";
import {
  assertWebhookFreshness,
  verifyCrmWebhookSignature,
} from "../src/lib/crm/runtime/webhooks";
import { createHmac } from "crypto";

let passed = 0;
function ok(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

ok("idempotency keys are stable", () => {
  const a = crmWriteIdempotencyKey({
    workspaceId: "w1",
    provider: "salesforce",
    action: "upsert",
    objectType: "contact",
    internalId: "c1",
    version: 2,
  });
  const b = crmWriteIdempotencyKey({
    workspaceId: "w1",
    provider: "salesforce",
    action: "upsert",
    objectType: "contact",
    internalId: "c1",
    version: 2,
  });
  assert.equal(a, b);
  assert.notEqual(
    a,
    crmWriteIdempotencyKey({
      workspaceId: "w1",
      provider: "salesforce",
      action: "upsert",
      objectType: "contact",
      internalId: "c1",
      version: 3,
    }),
  );
});

ok("event idempotency keys separate from write keys", () => {
  const e = crmEventIdempotencyKey({
    workspaceId: "w1",
    provider: "zoho",
    type: "call.completed",
    eventId: "evt-1",
  });
  assert.match(e, /^crm-e-zoho-call\.completed-evt-1/);
});

ok("payload sync hash stable under key order", () => {
  assert.equal(
    payloadSyncHash({ a: 1, b: "x" }),
    payloadSyncHash({ b: "x", a: 1 }),
  );
  assert.notEqual(payloadSyncHash({ a: 1 }), payloadSyncHash({ a: 2 }));
});

ok("field mappings outbound rewrite keys", () => {
  const out = applyFieldMappingsOutbound(
    { firstName: "Ada", phone: "+15551212" },
    [
      { internalField: "firstName", externalField: "FirstName", direction: "bidirectional" },
      { internalField: "phone", externalField: "Phone", direction: "outbound" },
      { internalField: "email", externalField: "Email", direction: "inbound" },
    ],
  );
  assert.equal(out.FirstName, "Ada");
  assert.equal(out.Phone, "+15551212");
  assert.equal(out.Email, undefined);
});

ok("pipedrive leads unsupported; others support contacts", () => {
  assert.equal(isFeatureSupported("pipedrive", "leads"), false);
  assert.equal(isFeatureSupported("salesforce", "contacts"), true);
  assert.equal(isFeatureSupported("zoho", "calls"), true);
});

ok("matrix honesty: beta is not sandbox-proven", () => {
  assert.equal(featureSupport("salesforce", "contacts"), "beta");
  assert.equal(isSandboxProven("salesforce", "contacts"), false);
  assert.match(supportLabel("beta"), /sandbox proof pending/i);
  assert.match(supportLabel("fallback"), /fallback/i);
});

ok("capability clamp disables pipedrive leads", () => {
  const clamped = clampPreferencesToCapabilities("pipedrive", {
    ...DEFAULT_SYNC_PREFERENCES,
    autoCreateLeads: true,
  });
  assert.equal(clamped.autoCreateLeads, false);
});

ok("default prefs include enterprise controls", () => {
  assert.equal(DEFAULT_SYNC_PREFERENCES.syncPaused, false);
  assert.equal(DEFAULT_SYNC_PREFERENCES.deletionPolicy, "mark_deleted");
  assert.equal(DEFAULT_SYNC_PREFERENCES.conflictPolicy, "manual_review");
});

ok("webhook signature verify", () => {
  const secret = "test-secret";
  const raw = '{"id":"1"}';
  const sig = createHmac("sha256", secret).update(raw).digest("hex");
  assert.equal(
    verifyCrmWebhookSignature({
      provider: "pipedrive",
      rawBody: raw,
      signatureHeader: sig,
      secret,
    }).ok,
    true,
  );
  assert.equal(
    verifyCrmWebhookSignature({
      provider: "pipedrive",
      rawBody: raw,
      signatureHeader: "deadbeef",
      secret,
    }).ok,
    false,
  );
});

ok("webhook freshness window", () => {
  assert.equal(assertWebhookFreshness(String(Math.floor(Date.now() / 1000))).ok, true);
  assert.equal(assertWebhookFreshness(String(Math.floor(Date.now() / 1000) - 3600)).ok, false);
});

ok("adapters export expected enterprise methods", async () => {
  const { salesforceConnector } = await import("../src/lib/crm/adapters/salesforce");
  const { zohoConnector } = await import("../src/lib/crm/adapters/zoho");
  const { pipedriveConnector } = await import("../src/lib/crm/adapters/pipedrive");
  for (const c of [salesforceConnector, zohoConnector, pipedriveConnector]) {
    assert.equal(typeof c.findContactByEmail, "function");
    assert.equal(typeof c.upsertContact, "function");
    assert.equal(typeof c.logCall, "function");
    assert.equal(typeof c.logSms, "function");
    assert.equal(typeof c.updateTask, "function");
    assert.equal(typeof c.listContacts, "function");
  }
});

console.log(`\n${passed} CRM enterprise checks passed.`);
