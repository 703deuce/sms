import assert from "node:assert/strict";
import {
  GLOBAL_TABLE_DEFAULT_PAGE_SIZE,
  GLOBAL_TABLE_PAGE_SIZE_OPTIONS,
  normalizeGlobalTablePageSize,
} from "../src/lib/ui/global-data-table";

assert.equal(GLOBAL_TABLE_DEFAULT_PAGE_SIZE, 10);
assert.deepEqual(GLOBAL_TABLE_PAGE_SIZE_OPTIONS, [5, 10, 25, 50]);
assert.equal(normalizeGlobalTablePageSize(undefined), 10);
assert.equal(normalizeGlobalTablePageSize(25), 25);
assert.equal(normalizeGlobalTablePageSize(100), 10);

console.log("test-global-data-table: ok");
