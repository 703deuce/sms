#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  workspaceSuppressionBlocksMassSms,
  workspaceSuppressionBlocksReviewSms,
} from "../src/lib/messaging/suppression-scope";

assert.equal(workspaceSuppressionBlocksMassSms(), false);
assert.equal(workspaceSuppressionBlocksReviewSms(), false);
console.log("PASS suppression-scope");
