import assert from "node:assert/strict";
import { readArSmsUsedFromLimits } from "./ar-sms-usage-limit-math";
import { USAGE_PERIOD_KEY, USAGE_USED } from "./ar-sms-usage-constants";

const period = "2026-10";

assert.equal(
  readArSmsUsedFromLimits({ [USAGE_PERIOD_KEY]: period, [USAGE_USED]: 3 }, period),
  3,
);
assert.equal(
  readArSmsUsedFromLimits({ [USAGE_PERIOD_KEY]: "2020-01", [USAGE_USED]: 99 }, period),
  0,
);

console.log("ar-sms-usage-reserve.test.ts: PASS");
