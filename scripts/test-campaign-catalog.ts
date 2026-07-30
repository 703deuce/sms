/**
 * Campaign library wiring checks.
 * Run: npx tsx scripts/test-campaign-catalog.ts
 */

import assert from "assert";
import {
  CAMPAIGN_CATEGORIES,
  buildSequenceForCategory,
  getCampaignCategory,
} from "../src/lib/campaigns/catalog";
import { buildClickToTextHref } from "../src/lib/growth/click-to-text";

assert.equal(CAMPAIGN_CATEGORIES.length, 14);
assert.ok(getCampaignCategory("follow_up"));
assert.ok(getCampaignCategory("broadcast"));
assert.ok(getCampaignCategory("custom"));

const follow = buildSequenceForCategory("follow_up", "Hi there", {
  delayHours: 2,
  followUpCount: 3,
  stopOnReply: true,
});
assert.ok(follow.some((s) => s.step_type === "wait"));
assert.ok(follow.some((s) => s.step_type === "condition"));
assert.ok(follow.some((s) => s.step_type === "send_sms"));

const broadcast = buildSequenceForCategory("broadcast", "Hello");
assert.equal(broadcast.filter((s) => s.step_type === "send_sms").length, 1);

const href = buildClickToTextHref("+17035551234", "JOIN");
assert.equal(href, "sms:+17035551234?body=JOIN");

console.log("campaign catalog checks passed");
