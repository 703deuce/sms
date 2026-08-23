import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dataForSeoRecoveryDeadlineMs,
  dataForSeoRetryDelayMaxMs,
  dataForSeoRetryDelayMinMs,
  dataForSeoRetryMaxRounds,
} from "@/lib/providers/maps-grid/config";

describe("DataForSEO sparse recovery config", () => {
  it("defaults to a ~10 minute wait/retry window like Bright Data", () => {
    assert.equal(dataForSeoRecoveryDeadlineMs(), 600_000);
    assert.equal(dataForSeoRetryDelayMinMs(), 8_000);
    assert.equal(dataForSeoRetryDelayMaxMs(), 15_000);
    assert.equal(dataForSeoRetryMaxRounds(), 40);
  });
});
