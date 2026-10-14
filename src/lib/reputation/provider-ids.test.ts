import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeProviderMessageId,
  providerMessageIdVariants,
  SUCCESSFUL_SEND_STATUSES,
} from "./provider-ids";

describe("provider message ids", () => {
  it("strips Brevo angle brackets", () => {
    assert.equal(normalizeProviderMessageId("<abc@domain>"), "abc@domain");
    assert.equal(normalizeProviderMessageId("abc@domain"), "abc@domain");
    assert.equal(normalizeProviderMessageId("  <x>  "), "x");
  });

  it("builds lookup variants for legacy rows", () => {
    assert.deepEqual(providerMessageIdVariants("<abc@domain>"), [
      "abc@domain",
      "<abc@domain>",
    ]);
  });

  it("includes delivered/clicked as successful send statuses", () => {
    assert.ok(SUCCESSFUL_SEND_STATUSES.includes("delivered"));
    assert.ok(SUCCESSFUL_SEND_STATUSES.includes("clicked"));
  });
});
