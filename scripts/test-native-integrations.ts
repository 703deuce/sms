/**
 * Native External Integration Framework contract tests (no live providers required).
 * Run: npx tsx scripts/test-native-integrations.ts
 */

import assert from "node:assert/strict";
import {
  NATIVE_PROVIDER_CATALOG,
  NATIVE_PROVIDER_IDS,
  getAdapter,
  getCapabilityMatrix,
  integrationQueueName,
  isExternalProvider,
  makeEventIdempotencyKey,
  priorityForIntegrationKind,
} from "../src/lib/integrations/framework";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "../src/lib/integrations/framework/secrets";

let passed = 0;
function ok(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed += 1;
      console.log(`✓ ${name}`);
    })
    .catch((err) => {
      console.error(`✗ ${name}`);
      throw err;
    });
}

async function main() {
  await ok("registers all ten providers with adapters", () => {
    assert.equal(NATIVE_PROVIDER_IDS.length, 10);
    for (const id of NATIVE_PROVIDER_IDS) {
      assert.equal(isExternalProvider(id), true);
      const adapter = getAdapter(id);
      assert.equal(adapter.id, id);
      assert.ok(adapter.capabilities);
      assert.equal(typeof adapter.validateConnection, "function");
      assert.equal(typeof adapter.identifyAccount, "function");
    }
  });

  await ok("separates oauth vs credential auth", () => {
    const oauth = NATIVE_PROVIDER_CATALOG.filter((p) => p.authKind === "oauth").map((p) => p.id);
    const creds = NATIVE_PROVIDER_CATALOG.filter((p) => p.authKind === "credentials").map(
      (p) => p.id,
    );
    assert.deepEqual(oauth.sort(), ["calendly", "mailchimp", "typeform"].sort());
    assert.ok(creds.includes("activecampaign"));
    assert.ok(creds.includes("highlevel"));
    assert.ok(!creds.includes("zendesk" as never));
  });

  await ok("capability matrix omits unsupported actions", () => {
    const matrix = getCapabilityMatrix();
    const calendly = matrix.find((m) => m.id === "calendly");
    assert.equal(calendly?.capabilities.actions.upsert_contact, undefined);
    assert.ok(calendly?.capabilities.objects.appointment);
    const klaviyo = matrix.find((m) => m.id === "klaviyo");
    assert.ok(klaviyo?.capabilities.actions.subscribe_marketing);
  });

  await ok("encrypts secrets with INTEGRATION_SECRET_KEY", () => {
    const prev = process.env.INTEGRATION_SECRET_KEY;
    process.env.INTEGRATION_SECRET_KEY = "test-integration-secret-key";
    const enc = encryptIntegrationSecret("super-secret-api-key");
    assert.match(String(enc), /^enc:v1:/);
    assert.equal(decryptIntegrationSecret(enc), "super-secret-api-key");
    process.env.INTEGRATION_SECRET_KEY = prev;
  });

  await ok("stable event idempotency keys", () => {
    const a = makeEventIdempotencyKey("mailchimp", "evt-1", "audience.member_added");
    const b = makeEventIdempotencyKey("mailchimp", "evt-1", "audience.member_added");
    const c = makeEventIdempotencyKey("mailchimp", "evt-2", "audience.member_added");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(a.length, 40);
  });

  await ok("provider-isolated queues and priorities", () => {
    assert.equal(integrationQueueName("calendly"), "ext-calendly");
    assert.ok(
      priorityForIntegrationKind("webhook") < priorityForIntegrationKind("initial"),
    );
    assert.ok(priorityForIntegrationKind("write") < priorityForIntegrationKind("incremental"));
  });

  await ok("normalizeWebhook samples for all adapters that support it", async () => {
    for (const id of NATIVE_PROVIDER_IDS) {
      const adapter = getAdapter(id);
      if (!adapter.normalizeWebhook) continue;
      const events = await adapter.normalizeWebhook("ws_test", {
        id: "sample-1",
        type: "test",
        email: "a@example.com",
        event: "invitee.created",
        payload: { uri: "x", email: "a@example.com", name: "A" },
        form_response: {
          token: "tf1",
          form_id: "f1",
          submitted_at: new Date().toISOString(),
          answers: [{ type: "email", email: "a@example.com", field: { id: "1" } }],
        },
      });
      assert.ok(Array.isArray(events));
      if (events[0]) {
        assert.equal(events[0].provider, id);
        assert.ok(events[0].idempotencyKey);
        assert.ok(events[0].eventType);
      }
    }
  });

  await ok("every integration job type has a registered consumer", async () => {
    const { handleJob } = await import("../src/lib/jobs/job-handlers");
    for (const jobType of [
      "integration_sync",
      "integration_webhook_process",
      "integration_automation_event",
    ]) {
      try {
        await handleJob(jobType, { workspaceId: "ws_missing", provider: "calendly" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        assert.ok(!/Unknown job type/.test(message), message);
      }
    }
  });

  await ok("HighLevel catalog is labeled as private token, not OAuth", () => {
    const hl = NATIVE_PROVIDER_CATALOG.find((p) => p.id === "highlevel");
    assert.equal(hl?.authKind, "credentials");
    assert.match(String(hl?.description), /Private Integration Token|private token/i);
  });

  console.log(`\n${passed} tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
