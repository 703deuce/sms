/**
 * Mass Texting inbox filter + import suppression tests.
 *
 * Run: npx tsx scripts/test-mass-texting-inbox-filters.ts
 */
import assert from "node:assert/strict";
import {
  buildConversationWhere,
  parseInboxSearchParams,
} from "../src/lib/mass-texting/inbox-filters";
import { appProductSourceToPrisma } from "../src/lib/mass-texting/product-source";

const params = new URLSearchParams("product=mass_text&unread=1&campaignId=camp_1");
const filters = parseInboxSearchParams(params);
assert.equal(filters.product, "mass_text");
assert.equal(filters.unread, true);
assert.equal(filters.campaignId, "camp_1");

const where = buildConversationWhere("ws_1", filters);
assert.equal(where.workspaceId, "ws_1");
assert.equal(where.productSource, appProductSourceToPrisma("mass_text"));
assert.equal(where.unread, true);
assert.equal(where.campaignId, "camp_1");

const mctbWhere = buildConversationWhere("ws_1", { product: "mctb" });
assert.equal(mctbWhere.productSource, "MCTB");

console.log("test-mass-texting-inbox-filters: ok");
