/**
 * Missed calls list filter query parsing.
 * Run: npx tsx scripts/test-mctb-missed-calls-filters.ts
 */
import assert from "node:assert/strict";
import {
  buildMissedCallsListWhere,
  parseMissedCallsListQuery,
} from "../src/lib/mctb/missed-calls-list-filters";

const q = parseMissedCallsListQuery(
  new URLSearchParams("status=suppressed&date=7d&page=2&q=571"),
);
assert.equal(q.status, "suppressed");
assert.equal(q.date, "7d");
assert.equal(q.page, 2);
assert.equal(q.q, "571");
assert.equal(q.pageSize, 10);

const defaultSize = parseMissedCallsListQuery(new URLSearchParams(""));
assert.equal(defaultSize.pageSize, 10);

const sized = parseMissedCallsListQuery(new URLSearchParams("pageSize=25"));
assert.equal(sized.pageSize, 25);

const invalid = parseMissedCallsListQuery(new URLSearchParams("pageSize=99"));
assert.equal(invalid.pageSize, 10);

const where = buildMissedCallsListWhere("ws1", q);
assert.equal(where.workspaceId, "ws1");
assert.ok(where.detectedAt);

console.log("test-mctb-missed-calls-filters: ok");
