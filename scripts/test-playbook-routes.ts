/**
 * Playbook routing + automation seed checks.
 * Run: npx tsx scripts/test-playbook-routes.ts
 */

import assert from "assert";
import { CAMPAIGN_CATEGORIES } from "../src/lib/campaigns/catalog";
import { playbookHref } from "../src/lib/campaigns/playbook-routes";
import {
  buildAutomationDefinitionFromCampaignPlaybook,
  campaignPlaybookAutomationName,
} from "../src/lib/campaigns/playbook-automation";
import { seedBroadcastComposeFromPlaybook } from "../src/lib/campaigns/playbook-broadcast";

for (const cat of CAMPAIGN_CATEGORIES) {
  const href = playbookHref(cat);
  if (cat.engine === "broadcast") {
    assert.match(href, /^\/campaigns\/new\?playbook=/);
    assert.ok(href.includes(cat.id), `${cat.id} broadcast href`);
  } else if (cat.engine === "automation") {
    assert.equal(href, `/automations/new?playbook=${cat.id}`, cat.id);
  } else {
    assert.equal(href, `/campaigns/new/${cat.id}`, cat.id);
  }
}

const missed = buildAutomationDefinitionFromCampaignPlaybook("missed_call");
assert.ok(missed);
assert.equal(missed!.nodes.filter((n) => n.type === "trigger").length, 1);
assert.equal(missed!.nodes.find((n) => n.type === "trigger")?.data.blockType, "call_missed");
assert.ok(missed!.nodes.some((n) => n.data.blockType === "send_sms"));

const status = buildAutomationDefinitionFromCampaignPlaybook("status_update");
assert.ok(status);
assert.equal(
  status!.nodes.find((n) => n.type === "trigger")?.data.blockType,
  "integration_order_updated",
);

const custom = buildAutomationDefinitionFromCampaignPlaybook("custom");
assert.ok(custom);
assert.equal(custom!.nodes.length, 1);
assert.equal(custom!.nodes[0]?.data.blockType, "inbound_call");

assert.equal(
  campaignPlaybookAutomationName("missed_call"),
  "Reply to Missed Calls or Messages",
);

const promo = seedBroadcastComposeFromPlaybook("promotion", { name: "", message: "" });
assert.equal(promo.name, "New promotion");
assert.ok(promo.message.includes("{{first_name}}"));
assert.equal(promo.categoryId, "promotion");

const broadcast = seedBroadcastComposeFromPlaybook("broadcast", { name: "", message: "" });
assert.equal(broadcast.name, "New announcement");
assert.equal(broadcast.categoryId, "broadcast");

const forced = seedBroadcastComposeFromPlaybook(
  "promotion",
  { name: "Old name", message: "Old message" },
  { force: true },
);
assert.equal(forced.name, "New promotion");
assert.ok(forced.message.includes("{{first_name}}"));

assert.equal(buildAutomationDefinitionFromCampaignPlaybook("welcome"), null);

console.log("playbook route checks passed");
