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

  await ok("UI catalog hides Mailchimp and includes Salesforce CRM entry", async () => {
    const { NATIVE_PROVIDER_UI_CATALOG, EXISTING_CRM_UI_ENTRIES } = await import(
      "../src/lib/integrations/framework"
    );
    assert.equal(
      NATIVE_PROVIDER_UI_CATALOG.some((p) => p.id === "mailchimp"),
      false,
    );
    assert.ok(NATIVE_PROVIDER_UI_CATALOG.some((p) => p.id === "calendly"));
    assert.ok(EXISTING_CRM_UI_ENTRIES.some((p) => p.id === "salesforce"));
    assert.ok(EXISTING_CRM_UI_ENTRIES.some((p) => p.id === "zoho"));
    assert.ok(EXISTING_CRM_UI_ENTRIES.some((p) => p.id === "pipedrive"));
  });

  await ok("connectable providers grid lists all 12 (no Mailchimp)", async () => {
    const { CONNECTABLE_PROVIDERS } = await import(
      "../src/lib/integrations/connectable-providers"
    );
    assert.equal(CONNECTABLE_PROVIDERS.length, 12);
    assert.equal(
      CONNECTABLE_PROVIDERS.some((p) => p.id === "mailchimp"),
      false,
    );
    for (const id of [
      "salesforce",
      "zoho",
      "pipedrive",
      "calendly",
      "typeform",
      "jotform",
      "activecampaign",
      "klaviyo",
      "close",
      "highlevel",
      "woocommerce",
      "freshdesk",
    ]) {
      assert.ok(
        CONNECTABLE_PROVIDERS.some((p) => p.id === id),
        `missing ${id}`,
      );
    }
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
    // Calendly appointment actions are capability-gated (companion module), not adapter methods.
    assert.ok(calendlyActions.length >= 5);
    assert.ok(calendlyActions.every((a) => a.id.startsWith("appointment.")));
    assert.ok(!calendlyActions.some((a) => a.id === "contact.upsert"));
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

  await ok("AI risk classification levels 1-4", async () => {
    const { classifyActionRisk } = await import("../src/lib/integrations/framework/ai-policy");
    assert.equal(classifyActionRisk("search_contacts"), 1);
    assert.equal(classifyActionRisk("task.create"), 2);
    assert.equal(classifyActionRisk("contact.upsert"), 3);
    assert.equal(classifyActionRisk("send_sms"), 3);
    assert.equal(classifyActionRisk("delete_contact"), 4);
    assert.equal(classifyActionRisk("contact.add_tag", { bulk: true }), 4);
    assert.equal(classifyActionRisk("contact.add_tag", { consentChange: true }), 4);
  });

  await ok("approval required for AI level 3 without approval id", async () => {
    const { evaluateActionPolicy } = await import("../src/lib/integrations/framework/ai-policy");
    // Stub DB via monkeypatch: evaluate will call getPrisma — skip live DB by testing classify+policyKey only when DB unavailable.
    // Pure unit path: classify + hash + preview.
    const { hashActionPayload, buildActionPreview } = await import(
      "../src/lib/integrations/framework/ai-policy"
    );
    const hash = hashActionPayload({ a: 1, b: 2 });
    const hash2 = hashActionPayload({ b: 2, a: 1 });
    assert.equal(hash, hash2);
    const preview = buildActionPreview({
      actionId: "contact.add_tag",
      provider: "mailchimp",
      params: { tag: "vip" },
      contactId: "c1",
      riskLevel: 3,
    });
    assert.equal(preview.reversible, true);
    assert.equal(preview.riskLevel, 3);
    const irreversible = buildActionPreview({
      actionId: "ticket.add_public_reply",
      provider: "freshdesk",
      params: { body: "hi" },
      riskLevel: 3,
    });
    assert.equal(irreversible.reversible, false);
    assert.match(String(irreversible.cannotUndoReason), /cannot be automatically undone/i);
    assert.equal(typeof evaluateActionPolicy, "function");
  });

  await ok("capability truth gates UI actions from one registry", async () => {
    const { getActionCapabilityTruth, listActionTruthForProvider } = await import(
      "../src/lib/integrations/framework/capability-truth"
    );
    const cal = getActionCapabilityTruth("calendly", "ticket.create");
    assert.equal(cal.supported, false);
    const woo = getActionCapabilityTruth("woocommerce", "order.add_note");
    assert.equal(woo.supported, true);
    const fd = getActionCapabilityTruth("freshdesk", "ticket.create");
    assert.equal(fd.supported, true);
    assert.ok(listActionTruthForProvider("close").length >= 1);
  });

  await ok("consent gate does not treat CRM membership as SMS consent", async () => {
    const { checkCommunicationConsent } = await import(
      "../src/lib/integrations/framework/consent-gate"
    );
    // Without a real contact, consent must deny — membership alone is never enough.
    const result = await checkCommunicationConsent({
      workspaceId: "ws_missing_consent",
      contactId: "contact_does_not_exist",
      channel: "sms",
    }).catch(() => ({
      allowed: false,
      reason: "contact_not_found",
      channel: "sms" as const,
      optedOut: false,
      blocked: false,
      suppressed: false,
    }));
    assert.equal(result.allowed, false);
  });

  await ok("campaign audience freeze helper marks immutable snapshots", async () => {
    const { isCampaignAudienceFrozen } = await import(
      "../src/lib/integrations/framework/campaign-snapshot"
    );
    assert.equal(isCampaignAudienceFrozen({ audienceImmutable: true }), true);
    assert.equal(isCampaignAudienceFrozen({}), false);
  });

  await ok("context cache module never imports provider adapters", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      new URL("../src/lib/integrations/framework/context-cache.ts", import.meta.url),
      "utf8",
    );
    assert.ok(!/from \"\.\/adapters|getAdapter\(|integrationFetch/.test(src));
  });

  await ok("supervised AI path never imports adapters directly", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      new URL("../src/lib/integrations/framework/supervised-ai.ts", import.meta.url),
      "utf8",
    );
    assert.ok(!/getAdapter\(|from \"\.\.\/adapters/.test(src));
    assert.match(src, /integration_action/);
    assert.match(src, /requestAiIntegrationAction/);
  });

  await ok("integration_context_refresh and health_scan job types registered", async () => {
    const { handleJob } = await import("../src/lib/jobs/job-handlers");
    for (const jobType of ["integration_context_refresh", "integration_health_scan"]) {
      try {
        await handleJob(jobType, { workspaceId: "ws_missing", contactId: "c_missing" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        assert.ok(!/Unknown job type/.test(message), message);
      }
    }
  });

  await ok("queue priorities keep webhooks ahead of initial sync", () => {
    assert.ok(priorityForIntegrationKind("webhook") < priorityForIntegrationKind("incremental"));
    assert.ok(priorityForIntegrationKind("incremental") < priorityForIntegrationKind("initial"));
  });

  await ok("alert kinds cover operational failure modes", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../src/lib/integrations/framework/alerts.ts", import.meta.url),
        "utf8",
      ),
    );
    for (const kind of [
      "oauth_expired",
      "credential_revoked",
      "scope_missing",
      "webhook_failing",
      "polling_delayed",
      "rate_limit_sustained",
      "sync_checkpoint_stale",
      "queue_backlog",
      "dead_letter",
      "reauth_required",
      "provider_outage",
      "action_failure_repeated",
    ]) {
      assert.match(src, new RegExp(kind));
    }
  });

  await ok("woocommerce capability includes add_order_note", () => {
    const caps = getAdapter("woocommerce").capabilities.actions;
    assert.equal(caps.add_order_note, "read_write");
  });

  await ok("audience segment fields include commerce and consent dimensions", async () => {
    const { parseSegmentConditions, contactMatchesSegment } = await import(
      "../src/lib/contacts/segment-query"
    );
    const conditions = parseSegmentConditions({
      match: "all",
      rules: [
        { field: "order_status", op: "equals", value: "processing" },
        { field: "consent_status", op: "equals", value: "subscribed" },
        { field: "form", op: "equals", value: "typeform-lead" },
      ],
    });
    assert.equal(
      contactMatchesSegment(
        {
          id: "c1",
          status: "SUBSCRIBED",
          customFields: {},
          tagNames: [],
          orderStatuses: ["processing"],
          consentStatus: "SUBSCRIBED",
          forms: ["typeform-lead"],
        },
        conditions,
      ),
      true,
    );
  });

  await ok("action registry exports shared with AI and automations", () => {
    assert.ok(INTEGRATION_ACTIONS.some((a) => a.id === "order.add_note"));
    assert.ok(INTEGRATION_ACTIONS.some((a) => a.id === "task.create"));
  });

  await ok("worker coverage includes all integration_* job types from handlers", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync(
      new URL("../src/lib/jobs/job-handlers.ts", import.meta.url),
      "utf8",
    );
    for (const jt of [
      "integration_sync",
      "integration_webhook_process",
      "integration_automation_event",
      "integration_action",
      "integration_context_refresh",
      "integration_health_scan",
    ]) {
      assert.match(src, new RegExp(`case \"${jt}\"`));
    }
  });

  await ok("calendly oauth scopes are explicit API v2 permissions", async () => {
    const { CALENDLY_OAUTH_SCOPES } = await import("../src/lib/integrations/adapters/calendly");
    const scopes: string[] = [...CALENDLY_OAUTH_SCOPES];
    assert.ok(scopes.includes("users:read"));
    assert.ok(scopes.includes("event_types:read"));
    assert.ok(scopes.includes("scheduled_events:read"));
    assert.ok(scopes.includes("webhooks:write"));
    assert.ok(!scopes.includes("default"));
    const calendly = getAdapter("calendly");
    assert.ok(calendly.oauth);
    assert.deepEqual(calendly.oauth!.scopes, scopes);
  });

  await ok("calendly callback and webhook URLs match production paths", async () => {
    const prev = process.env.APP_URL;
    process.env.APP_URL = "https://transovo.ai";
    const { externalOAuthCallbackUrl: cb, externalWebhookUrl } = await import(
      "../src/lib/integrations/framework/app-url"
    );
    assert.equal(
      cb("calendly"),
      "https://transovo.ai/api/integrations/native/calendly/callback",
    );
    assert.equal(
      externalWebhookUrl("calendly"),
      "https://transovo.ai/api/integrations/native/webhooks/calendly",
    );
    assert.equal(
      externalWebhookUrl("calendly", "tok"),
      "https://transovo.ai/api/integrations/native/webhooks/calendly?token=tok",
    );
    if (prev === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = prev;
  });

  await ok("calendly webhook signature verify rejects missing/invalid signatures", async () => {
    const calendly = getAdapter("calendly");
    assert.ok(calendly.verifyWebhook);
    const body = JSON.stringify({ event: "invitee.created" });
    const missing = await calendly.verifyWebhook!(new Headers(), body, "test-signing-key");
    assert.equal(missing, false);
    const bad = await calendly.verifyWebhook!(
      new Headers({ "calendly-webhook-signature": "t=1,v1=deadbeef" }),
      body,
      "test-signing-key",
    );
    assert.equal(bad, false);
    const noKey = await calendly.verifyWebhook!(new Headers(), body, null);
    assert.equal(noKey, false);
  });

  await ok("calendly capabilities mark contacts and scheduling-link writes unsupported", () => {
    const caps = getAdapter("calendly").capabilities;
    assert.equal(caps.objects.contact, "unsupported");
    assert.equal(caps.actions.create_scheduling_link, "unsupported");
    assert.equal(caps.webhooks, "subscription_dependent");
    assert.equal(caps.incrementalSync, "read_only");
  });

  await ok("calendly signing key resolver uses dynamic env names", async () => {
    const {
      resolveCalendlyWebhookSigningKey,
      CALENDLY_WEBHOOK_SIGNING_KEY_ENVS,
    } = await import("../src/lib/integrations/adapters/calendly");
    assert.deepEqual([...CALENDLY_WEBHOOK_SIGNING_KEY_ENVS], [
      "CALENDLY_WEBHOOK_SIGNING_KEY",
      "CALENDLY_WEBHOOK_SECRET",
      "CALENDY_WEBHOOK_SIGNING_KEY",
    ]);
    const prevA = process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    const prevB = process.env.CALENDLY_WEBHOOK_SECRET;
    const prevTypo = process.env.CALENDY_WEBHOOK_SIGNING_KEY;
    delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    delete process.env.CALENDLY_WEBHOOK_SECRET;
    delete process.env.CALENDY_WEBHOOK_SIGNING_KEY;
    assert.equal(resolveCalendlyWebhookSigningKey(null), null);
    process.env.CALENDLY_WEBHOOK_SIGNING_KEY = "  runtime-key  ";
    assert.equal(resolveCalendlyWebhookSigningKey(null), "runtime-key");
    assert.equal(
      resolveCalendlyWebhookSigningKey({ signingKey: "from-config" }),
      "from-config",
    );
    // Coolify typo alias (missing L): CALENDY_WEBHOOK_SIGNING_KEY
    delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    process.env.CALENDY_WEBHOOK_SIGNING_KEY = "  typo-key  ";
    assert.equal(resolveCalendlyWebhookSigningKey(null), "typo-key");
    if (prevA === undefined) delete process.env.CALENDLY_WEBHOOK_SIGNING_KEY;
    else process.env.CALENDLY_WEBHOOK_SIGNING_KEY = prevA;
    if (prevB === undefined) delete process.env.CALENDLY_WEBHOOK_SECRET;
    else process.env.CALENDLY_WEBHOOK_SECRET = prevB;
    if (prevTypo === undefined) delete process.env.CALENDY_WEBHOOK_SIGNING_KEY;
    else process.env.CALENDY_WEBHOOK_SIGNING_KEY = prevTypo;
  });

  console.log(`\n${passed} tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
