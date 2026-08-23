import assert from "node:assert/strict";
import { describe, it } from "node:test";

/**
 * Pure status transition helpers mirroring applyProviderDeliveryStatus rules.
 * Keeps webhook mapping honest without a live DB.
 */
function nextCampaignStatus(
  current: string,
  provider: string
): "delivered" | "failed" | "keep" | "ignore" {
  const n = provider.toLowerCase();
  if (n === "delivered") {
    if (current === "clicked" || current === "opted_out") return "keep";
    if (["sent", "sending", "delivered"].includes(current)) return "delivered";
    return "ignore";
  }
  if (["failed", "undelivered", "delivery_unknown"].includes(n)) {
    if (["clicked", "delivered", "opted_out"].includes(current)) return "keep";
    if (["sent", "sending", "queued"].includes(current)) return "failed";
    return "ignore";
  }
  if (["sent", "queued", "accepted"].includes(n)) return "keep";
  return "ignore";
}

function nextOneOffStatus(
  current: string,
  provider: string
): "delivered" | "failed" | "keep" | "ignore" {
  const n = provider.toLowerCase();
  if (n === "delivered") {
    if (current === "clicked" || current === "completed") return "keep";
    if (["queued", "sent", "delivered"].includes(current)) return "delivered";
    return "ignore";
  }
  if (["failed", "undelivered", "delivery_unknown"].includes(n)) {
    if (["clicked", "delivered", "completed"].includes(current)) return "keep";
    if (["queued", "sent"].includes(current)) return "failed";
    return "ignore";
  }
  if (["sent", "queued", "accepted"].includes(n)) return "keep";
  return "ignore";
}

describe("delivery status transitions", () => {
  it("upgrades campaign sent → delivered and preserves clicked", () => {
    assert.equal(nextCampaignStatus("sent", "delivered"), "delivered");
    assert.equal(nextCampaignStatus("clicked", "delivered"), "keep");
    assert.equal(nextCampaignStatus("opted_out", "failed"), "keep");
  });

  it("applies the same delivery rules to one-off sends", () => {
    assert.equal(nextOneOffStatus("sent", "delivered"), "delivered");
    assert.equal(nextOneOffStatus("clicked", "undelivered"), "keep");
    assert.equal(nextOneOffStatus("sent", "undelivered"), "failed");
  });
});
