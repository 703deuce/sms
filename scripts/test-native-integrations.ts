/**
 * Native External Integration Framework + product wiring contract tests.
 * Run: npm run test:native-integrations
 */

import assert from "node:assert/strict";
import {
  NATIVE_PROVIDER_CATALOG,
  NATIVE_PROVIDER_IDS,
  actionsForProvider,
  externalOAuthCallbackUrl,
  getAdapter,
  getCapabilityMatrix,
  getIntegrationAppUrl,
  getIntegrationEnvHealth,
  INTEGRATION_ACTIONS,
  INTEGRATION_EVENT_TO_TRIGGER,
  integrationQueueName,
  isExternalProvider,
  listIntegrationTriggerBlocks,
  makeEventIdempotencyKey,
  priorityForIntegrationKind,
  triggersForProvider,
} from "../src/lib/integrations/framework";
import {
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "../src/lib/integrations/framework/secrets";
import { AUTOMATION_BLOCKS } from "../src/lib/automations/catalog";

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
    assert.deepEqual(oauth.sort(), ["calendly", "mailchimp", "typeform"].sort());
  });

  await ok("capability matrix omits unsupported actions", () => {
    const calendly = getCapabilityMatrix().find((m) => m.id === "calendly");
    assert.equal(calendly?.capabilities.actions.upsert_contact, undefined);
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
    assert.equal(a, b);
  });

  await ok("provider-isolated queues and priorities", () => {
    assert.equal(integrationQueueName("calendly"), "ext-calendly");
    assert.ok(priorityForIntegrationKind("webhook") < priorityForIntegrationKind("initial"));
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
    }
  });

  await ok("every integration job type has a registered consumer", async () => {
    const { handleJob } = await import("../src/lib/jobs/job-handlers");
    for (const jobType of [
      "integration_sync",
      "integration_webhook_process",
      "integration_automation_event",
      "integration_action",
    ]) {
      try {
        await handleJob(jobType, {
          workspaceId: "ws_missing",
          provider: "calendly",
          actionId: "contact.upsert",
          params: {},
        });
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

  await ok("authoritative callback URLs use APP_URL helper", () => {
    const prev = process.env.APP_URL;
    process.env.APP_URL = "https://transovo.ai";
    assert.equal(getIntegrationAppUrl(), "https://transovo.ai");
    assert.equal(
      externalOAuthCallbackUrl("calendly"),
      "https://transovo.ai/api/integrations/native/calendly/callback",
    );
    assert.equal(
      externalOAuthCallbackUrl("mailchimp"),
      "https://transovo.ai/api/integrations/native/mailchimp/callback",
    );
    assert.equal(
      externalOAuthCallbackUrl("typeform"),
      "https://transovo.ai/api/integrations/native/typeform/callback",
    );
    process.env.APP_URL = prev;
  });

  await ok("env health never exposes secrets", () => {
    process.env.CALENDLY_CLIENT_SECRET = "secret-value-should-not-leak";
    const health = getIntegrationEnvHealth();
    const blob = JSON.stringify(health);
    assert.ok(!blob.includes("secret-value-should-not-leak"));
    assert.ok(["configured", "missing", "invalid_format"].includes(health.appUrl.status));
  });

  await ok("automation catalog includes integration triggers and action", () => {
    const triggers = AUTOMATION_BLOCKS.filter((b) => b.blockType.startsWith("integration_"));
    assert.ok(triggers.length >= 15);
    assert.ok(AUTOMATION_BLOCKS.some((b) => b.blockType === "integration_action"));
    assert.ok(listIntegrationTriggerBlocks().length >= 10);
  });

  await ok("event→trigger map covers appointment/form/order/ticket", () => {
    assert.equal(
      INTEGRATION_EVENT_TO_TRIGGER["appointment.scheduled"],
      "integration_appointment_scheduled",
    );
    assert.equal(INTEGRATION_EVENT_TO_TRIGGER["form.submitted"], "integration_form_submitted");
    assert.equal(INTEGRATION_EVENT_TO_TRIGGER["order.paid"], "integration_order_paid");
    assert.equal(
      INTEGRATION_EVENT_TO_TRIGGER["support_ticket.created"],
      "integration_ticket_created",
    );
  });

  await ok("action registry only exposes methods the adapter implements", () => {
    assert.ok(INTEGRATION_ACTIONS.length >= 8);
    const calendlyActions = actionsForProvider("calendly");
    assert.equal(calendlyActions.length, 0);
    const ac = actionsForProvider("activecampaign");
    assert.ok(ac.some((a) => a.id === "contact.upsert"));
    const freshdesk = actionsForProvider("freshdesk");
    assert.ok(freshdesk.some((a) => a.id === "ticket.create"));
  });

  await ok("trigger listing respects capability declarations", () => {
    const cal = triggersForProvider("calendly");
    assert.ok(cal.some((t) => t.eventType === "appointment.scheduled"));
  });

  await ok("unsupported action returns typed unsupported result", async () => {
    const { executeIntegrationAction } = await import(
      "../src/lib/integrations/framework/actions-registry"
    );
    const result = await executeIntegrationAction({
      workspaceId: "ws_x",
      provider: "calendly",
      actionId: "ticket.create",
      params: {},
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "UNSUPPORTED");
  });

  await ok("segment rules accept source and provider fields", async () => {
    const { parseSegmentConditions, contactMatchesSegment } = await import(
      "../src/lib/contacts/segment-query"
    );
    const conditions = parseSegmentConditions({
      match: "all",
      rules: [
        { field: "provider", op: "equals", value: "calendly" },
        { field: "source", op: "equals", value: "calendly" },
      ],
    });
    assert.equal(conditions.rules.length, 2);
    assert.equal(
      contactMatchesSegment(
        {
          id: "c1",
          status: "SUBSCRIBED",
          customFields: {},
          tagNames: [],
          source: "calendly",
          providers: ["calendly"],
        },
        conditions,
      ),
      true,
    );
    assert.equal(
      contactMatchesSegment(
        {
          id: "c2",
          status: "SUBSCRIBED",
          customFields: {},
          tagNames: [],
          source: "manual",
          providers: [],
        },
        conditions,
      ),
      false,
    );
  });

  console.log(`\n${passed} tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
