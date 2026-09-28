import assert from "node:assert/strict";
import {
  clampMctbMaxMessagesPerCaller,
  mctbMaxMessagesSelectOptions,
} from "../src/lib/mctb/recovery-max-messages";

assert.equal(clampMctbMaxMessagesPerCaller(100), 5);
assert.equal(clampMctbMaxMessagesPerCaller(0), 1);
assert.deepEqual(mctbMaxMessagesSelectOptions(100), ["1", "2", "3", "5"]);
console.log("test-mctb-recovery-max-messages-field: OK");
