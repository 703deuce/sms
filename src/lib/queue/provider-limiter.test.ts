import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  acquireProviderSlot,
  providerLimiterConfig,
} from "@/lib/queue/provider-limiter";

describe("provider limiter", () => {
  it("exposes twilio and brevo rate config", () => {
    const twilio = providerLimiterConfig("twilio");
    const brevo = providerLimiterConfig("brevo");
    assert.ok(twilio.startRate > 0);
    assert.ok(twilio.maxInFlight > 0);
    assert.ok(brevo.startRate > 0);
    assert.ok(brevo.maxInFlight >= twilio.maxInFlight || brevo.maxInFlight > 0);
  });

  it("acquires and releases an in-process slot", async () => {
    const slot = await acquireProviderSlot("brevo", 2_000);
    assert.equal(typeof slot.release, "function");
    await slot.release();
    await slot.release(); // idempotent
  });
});
