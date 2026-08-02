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
    assert.equal(typeof c.upsertCompany, "function");
    assert.equal(typeof c.upsertDeal, "function");
  }
});

ok("Salesforce OAuth requires PKCE (code challenge)", async () => {
  const { salesforceConnector } = await import("../src/lib/crm/adapters/salesforce");
  assert.equal(salesforceConnector.oauth.requiresPkce, true);
});

ok("conflict policy both-sides resolution", async () => {
  const { resolveBothSidesConflict } = await import("../src/lib/crm/conflict");
  assert.equal(
    resolveBothSidesConflict({
      policy: "transovo_wins",
      localChangedSinceSync: true,
      remoteChangedSinceSync: true,
    }),
    "keep_local",
  );
  assert.equal(
    resolveBothSidesConflict({
      policy: "crm_wins",
      localChangedSinceSync: true,
      remoteChangedSinceSync: true,
    }),
    "apply_crm",
  );
  assert.equal(
    resolveBothSidesConflict({
      policy: "most_recent",
      localChangedSinceSync: true,
      remoteChangedSinceSync: true,
      lastCrmModifiedAt: new Date("2026-01-02"),
      lastInternalModifiedAt: new Date("2026-01-01"),
    }),
    "apply_crm",
  );
  assert.equal(
    resolveBothSidesConflict({
      policy: "manual_review",
      localChangedSinceSync: true,
      remoteChangedSinceSync: true,
    }),
    "manual_review",
  );
});

ok("field validation coerces types", async () => {
  const { coerceFieldValue, validateMappedPayload } = await import(
    "../src/lib/crm/field-validate"
  );
  assert.equal(coerceFieldValue("42", "number").ok, true);
  assert.equal((coerceFieldValue("42", "number") as { value: number }).value, 42);
  assert.equal(coerceFieldValue("not-a-number", "number").ok, false);
  const validated = validateMappedPayload({ Website: "notaurl", Amount: "10" });
  assert.equal(validated.payload.Amount, 10);
  assert.ok(validated.issues.some((i) => i.field === "Website"));
});

ok("Bigin clamps lead creation", () => {
  const clamped = clampPreferencesToCapabilities("zoho", {
    ...DEFAULT_SYNC_PREFERENCES,
    zohoProduct: "bigin",
    autoCreateLeads: true,
  });
  assert.equal(clamped.autoCreateLeads, false);
});

ok("CRM RBAC matrix", async () => {
  const { canCrmAction } = await import("../src/lib/crm/permissions");
  assert.equal(canCrmAction("OWNER", "connect_crm"), true);
  assert.equal(canCrmAction("INBOX_AGENT", "connect_crm"), false);
  assert.equal(canCrmAction("MANAGER", "run_manual_sync"), true);
  assert.equal(canCrmAction("READ_ONLY", "disconnect_crm"), false);
});

ok("MMS preference defaults on", () => {
  assert.equal(DEFAULT_SYNC_PREFERENCES.syncMms, true);
});

ok("rules split missed call log vs task", async () => {
  const { defaultCrmRules } = await import("../src/lib/crm/runtime/rules");
  const rules = defaultCrmRules();
  assert.ok(rules.some((r) => r.id === "missed_call_log" && r.requiresPref === "syncCalls"));
  assert.ok(
    rules.some((r) => r.id === "missed_call_task" && r.requiresPref === "createTasksOnMissedCall"),
  );
  assert.ok(rules.some((r) => r.id === "sms_unread_task"));
  assert.ok(rules.some((r) => r.id === "voicemail_task"));
});

ok("Bigin API base helper branches", async () => {
  const { zohoConnector } = await import("../src/lib/crm/adapters/zoho");
  // Smoke: listLeads returns empty for Bigin preferences without network
  const empty = await zohoConnector.listLeads!(
    {
      workspaceId: "w",
      accessToken: "t",
      meta: {},
      preferences: { ...DEFAULT_SYNC_PREFERENCES, zohoProduct: "bigin" },
    },
    null,
  );
  assert.deepEqual(empty.items, []);
});

ok("quarantine clear exported", async () => {
  const mod = await import("../src/lib/crm/circuit-breaker");
  assert.equal(typeof mod.clearCrmQuarantine, "function");
  assert.equal(typeof mod.notifyCrmHealthAlert, "function");
});

ok("adapters expose inbound activity lists + updateNote", async () => {
  const { salesforceConnector } = await import("../src/lib/crm/adapters/salesforce");
  const { zohoConnector } = await import("../src/lib/crm/adapters/zoho");
  const { pipedriveConnector } = await import("../src/lib/crm/adapters/pipedrive");
  for (const c of [salesforceConnector, zohoConnector, pipedriveConnector]) {
    assert.equal(typeof c.listTasks, "function");
    assert.equal(typeof c.listNotes, "function");
    assert.equal(typeof c.listActivities, "function");
    assert.equal(typeof c.updateNote, "function");
    if (c.id !== "pipedrive") {
      assert.equal(typeof c.upsertLead, "function");
    }
  }
  // Salesforce intentionally omits handleWebhook so webhook ingest falls through
  // to incremental reconcile sync (CDC/Streaming not subscribed).
  assert.equal(typeof salesforceConnector.handleWebhook, "undefined");
  assert.equal(typeof zohoConnector.handleWebhook, "function");
  assert.equal(typeof pipedriveConnector.handleWebhook, "function");
});

ok("Salesforce OAuth callback + scopes + job handlers registered", async () => {
  const prev = process.env.APP_URL;
  const prevPublic = process.env.NEXT_PUBLIC_APP_URL;
  process.env.APP_URL = "https://transovo.ai";
  delete process.env.NEXT_PUBLIC_APP_URL;
  const { crmOAuthCallbackUrl } = await import("../src/lib/crm/oauth");
  const { scopesForProvider } = await import("../src/lib/crm/scopes");
  const { CRM_JOB_TYPES } = await import("../src/lib/crm/runtime/job-types");
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");

  assert.equal(
    crmOAuthCallbackUrl("salesforce"),
    "https://transovo.ai/api/crm/salesforce/callback",
  );
  const scopes = scopesForProvider("salesforce");
  assert.deepEqual(scopes, ["api", "refresh_token", "offline_access"]);
  assert.equal(scopes.includes("full"), false);

  const handlerSrc = readFileSync(join(process.cwd(), "src/lib/jobs/job-handlers.ts"), "utf8");
  for (const jobType of CRM_JOB_TYPES) {
    assert.ok(
      handlerSrc.includes(`case "${jobType}"`),
      `Missing job handler for ${jobType}`,
    );
  }

  // Every CRM enqueue site must use a registered job type.
  const emitFiles = [
    "src/lib/crm/sync-engine.ts",
    "src/lib/crm/runtime/event-bus.ts",
    "src/lib/crm/runtime/metadata-refresh.ts",
    "src/lib/crm/runtime/bulk-sync.ts",
    "src/lib/crm/runtime/webhooks.ts",
    "src/lib/jobs/job-handlers.ts",
  ];
  const emitted = new Set<string>();
  for (const file of emitFiles) {
    const src = readFileSync(join(process.cwd(), file), "utf8");
    for (const match of src.matchAll(/jobType:\s*"((?:crm_)[^"]+)"/g)) {
      emitted.add(match[1]!);
    }
  }
  for (const jobType of emitted) {
    assert.ok(
      (CRM_JOB_TYPES as readonly string[]).includes(jobType),
      `Salesforce/CRM integration emits unregistered job type: ${jobType}`,
    );
    assert.ok(
      handlerSrc.includes(`case "${jobType}"`),
      `No active handler for emitted CRM job type: ${jobType}`,
    );
  }

  if (prev === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = prev;
  if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prevPublic;
});

ok("CRM OAuth accepts NEXT_PUBLIC_APP_URL when APP_URL unset", async () => {
  const prev = process.env.APP_URL;
  const prevPublic = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://transovo.ai";
  const { crmOAuthCallbackUrl } = await import("../src/lib/crm/oauth");
  const { checkCrmEnvironment } = await import("../src/lib/crm/env-check");
  assert.equal(
    crmOAuthCallbackUrl("salesforce"),
    "https://transovo.ai/api/crm/salesforce/callback",
  );
  const env = checkCrmEnvironment("salesforce");
  assert.equal(env.items.find((i) => i.key === "APP_URL")?.ok, true);
  if (prev === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = prev;
  if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prevPublic;
});

ok("mergeInboundContact prefers local filled fields", async () => {
  const { mergeInboundContact } = await import("../src/lib/crm/conflict");
  const merged = mergeInboundContact(
    { firstName: "Local", lastName: null, email: "a@b.c", company: null },
    { firstName: "Remote", lastName: "R", email: "r@b.c", companyName: "Acme" },
  );
  assert.equal(merged.firstName, "Local");
  assert.equal(merged.lastName, "R");
  assert.equal(merged.email, "a@b.c");
  assert.equal(merged.company, "Acme");
});

ok("product CRM publishers exist for callback/appointment/lead/task", async () => {
  const events = await import("../src/lib/crm/events");
  assert.equal(typeof events.publishCallbackScheduled, "function");
  assert.equal(typeof events.publishAppointmentBooked, "function");
  assert.equal(typeof events.publishLeadCreated, "function");
  assert.equal(typeof events.publishTaskEvent, "function");
});

ok("appointment + callback rules are wired", async () => {
  const { defaultCrmRules } = await import("../src/lib/crm/runtime/rules");
  const rules = defaultCrmRules();
  assert.ok(rules.some((r) => r.id === "callback_task"));
  assert.ok(rules.some((r) => r.id === "appointment_note"));
  assert.ok(rules.some((r) => r.id === "appointment_task"));
  assert.ok(rules.some((r) => r.id === "lead_created"));
});

ok("appointment.booked is a supported subscription event", async () => {
  const { eventSupportLevel } = await import("../src/lib/crm/runtime/subscriptions");
  assert.equal(eventSupportLevel("salesforce", "appointment.booked"), "supported");
  assert.equal(eventSupportLevel("zoho", "callback.scheduled"), "supported");
  assert.equal(eventSupportLevel("pipedrive", "lead.created"), "unsupported");
});

ok("Zoho multi-DC accounts host resolution", async () => {
  const { resolveZohoAccountsServer } = await import("../src/lib/crm/oauth");
  assert.equal(resolveZohoAccountsServer({ location: "eu" }), "https://accounts.zoho.eu");
  assert.equal(resolveZohoAccountsServer({ location: "in" }), "https://accounts.zoho.in");
  assert.equal(
    resolveZohoAccountsServer({ accountsServer: "https://accounts.zoho.com.au/" }),
    "https://accounts.zoho.com.au",
  );
  assert.equal(resolveZohoAccountsServer({}), "https://accounts.zoho.com");
});

ok("provider-specific OAuth callback URLs", async () => {
  const prev = process.env.APP_URL;
  process.env.APP_URL = "https://transovo.ai";
  const { crmOAuthCallbackUrl } = await import("../src/lib/crm/oauth");
  assert.equal(
    crmOAuthCallbackUrl("salesforce"),
    "https://transovo.ai/api/crm/salesforce/callback",
  );
  assert.equal(crmOAuthCallbackUrl("zoho"), "https://transovo.ai/api/crm/zoho/callback");
  assert.equal(
    crmOAuthCallbackUrl("pipedrive"),
    "https://transovo.ai/api/crm/pipedrive/callback",
  );
  if (prev === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = prev;
});

ok("BullMQ job ids cannot contain colon", async () => {
  const { toBullmqJobId } = await import("../src/lib/jobs/bullmq");
  const raw = "campaign-send-batch:2026-08-01T22:12";
  const id = toBullmqJobId(raw);
  assert.equal(id.includes(":"), false);
  assert.equal(id, "campaign-send-batch_2026-08-01T22_12");
  assert.equal(toBullmqJobId("crm-sync-zoho-abc"), "crm-sync-zoho-abc");
});

ok("Zoho search DateTime format rejects ISO Z/millis", async () => {
  const { zohoSearchDateTime } = await import("../src/lib/crm/adapters/zoho");
  const formatted = zohoSearchDateTime(new Date("2026-08-01T23:08:19.748Z"));
  assert.equal(formatted, "2026-08-01T23:08:19+00:00");
  assert.equal(formatted.includes("Z"), false);
  assert.equal(formatted.includes("."), false);
});

ok("crmFetch never returns null on empty success body", async () => {
  const { crmFetch } = await import("../src/lib/crm/http");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(null, { status: 200, statusText: "OK" })) as typeof fetch;
  try {
    const data = await crmFetch<{ data?: unknown[] }>("https://example.test/empty");
    assert.equal(data == null, false);
    assert.deepEqual(data, {});
    assert.equal((data.data || []).length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

console.log(`\n${passed} CRM enterprise checks passed.`);
