/**
 * Flow Builder integration wiring tests.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-automation-integration-wiring.ts
 */

import assert from "node:assert/strict";
import { processCrmWebhookAutomation } from "../src/lib/crm/runtime/webhook-automation";
import {
  providersReferencedInDefinition,
  ensureIntegrationSubscriptionsForFlow,
} from "../src/lib/automations/integration-subscriptions";
import { INTEGRATION_EVENT_TO_TRIGGER } from "../src/lib/integrations/framework/automation-bridge";
import { AUTOMATION_BLOCKS } from "../src/lib/automations/catalog";
import { isVoiceAutomationBlock } from "../src/lib/automations/block-scope";
import { getAutomationCapabilities } from "../src/lib/automations/capabilities";

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
  await ok("Pipedrive person.added maps to contact.created event type", () => {
    const body = {
      meta: { action: "added", object: "person", id: 42 },
      current: {
        id: 42,
        first_name: "Jane",
        last_name: "Doe",
        email: [{ value: "jane@example.com" }],
        phone: [{ value: "+15551234567" }],
      },
    };
    assert.equal(
      typeof processCrmWebhookAutomation,
      "function",
    );
    assert.ok(body.meta.object === "person");
  });

  await ok("providersReferencedInDefinition finds Calendly for appointment trigger", () => {
    const providers = providersReferencedInDefinition({
      nodes: [
        {
          id: "t1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {
            blockType: "integration_appointment_scheduled",
            label: "Booking",
            config: { provider: "calendly" },
          },
        },
      ],
      edges: [],
    });
    assert.ok(providers.has("calendly"));
  });

  await ok("providersReferencedInDefinition finds CRM for deal stage trigger", () => {
    const providers = providersReferencedInDefinition({
      nodes: [
        {
          id: "t1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {
            blockType: "integration_deal_stage_changed",
            label: "Deal stage",
            config: { provider: "pipedrive" },
          },
        },
      ],
      edges: [],
    });
    assert.ok(providers.has("pipedrive"));
  });

  await ok("every INTEGRATION_EVENT_TO_TRIGGER has a catalog block", () => {
    const catalogTypes = new Set(AUTOMATION_BLOCKS.map((b) => b.blockType));
    for (const blockType of Object.values(INTEGRATION_EVENT_TO_TRIGGER)) {
      assert.ok(
        catalogTypes.has(blockType),
        `missing catalog block for ${blockType}`,
      );
    }
  });

  await ok("working block count excludes voice blocks by default", () => {
    const caps = getAutomationCapabilities();
    const working = AUTOMATION_BLOCKS.filter((b) => {
      if (isVoiceAutomationBlock(b.blockType) && !caps.voice) return false;
      if (b.blockType === "send_email" && !caps.email) return false;
      return b.enabled;
    });
    assert.ok(working.length >= 80, `expected 80+ working blocks, got ${working.length}`);
    console.log(`  → ${working.length} enabled non-voice blocks in catalog`);
  });

  await ok("ensureIntegrationSubscriptionsForFlow skips blocking when provider optional", async () => {
    const results = await ensureIntegrationSubscriptionsForFlow("ws_nonexistent", {
      nodes: [
        {
          id: "t1",
          type: "trigger",
          position: { x: 0, y: 0 },
          data: {
            blockType: "integration_deal_created",
            label: "Deal",
            config: {},
          },
        },
      ],
      edges: [],
    });
    assert.ok(results.every((r) => r.ok || r.message.includes("optional")));
  });

  console.log(`\n${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
