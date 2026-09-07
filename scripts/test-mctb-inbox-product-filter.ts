/**
 * Static verification: /conversations?product=mctb is parsed and applied to inbox queries.
 * Run: npx tsx scripts/test-mctb-inbox-product-filter.ts
 */
import assert from "node:assert/strict";
import { inboxFiltersFromUrlParams } from "../src/lib/inbox/conversation-url-filters";
import { buildConversationWhere } from "../src/lib/mass-texting/inbox-filters";
import { appProductSourceToPrisma } from "../src/lib/mass-texting/product-source";

const filters = inboxFiltersFromUrlParams({ product: "mctb" });
assert.equal(filters.product, "mctb");

const where = buildConversationWhere("ws_test", filters);
assert.equal(where.productSource, appProductSourceToPrisma("mctb"));

const allFilters = inboxFiltersFromUrlParams({});
assert.equal(allFilters.product, "all");

console.log("test-mctb-inbox-product-filter: ok");
