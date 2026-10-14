import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  claimQueuedCampaignMessage,
  createMemoryClaimStore,
} from "./campaign-claim";

describe("campaign message claim lock", () => {
  it("only one of two concurrent workers claims the same queued message", async () => {
    const store = createMemoryClaimStore(["msg-1"]);
    const ts = new Date().toISOString();

    const [a, b] = await Promise.all([
      claimQueuedCampaignMessage(store.client, "msg-1", ts),
      claimQueuedCampaignMessage(store.client, "msg-1", ts),
    ]);

    const winners = [a, b].filter(Boolean);
    assert.equal(winners.length, 1, "exactly one worker must win the claim");
    assert.equal(store.sendingCount(), 1);
    assert.equal(store.getStatus("msg-1"), "sending");
    assert.equal(store.claimOps(), 2, "both workers attempted the claim");
  });

  it("allows claims on different messages in parallel", async () => {
    const store = createMemoryClaimStore(["msg-1", "msg-2"]);
    const ts = new Date().toISOString();
    const [a, b] = await Promise.all([
      claimQueuedCampaignMessage(store.client, "msg-1", ts),
      claimQueuedCampaignMessage(store.client, "msg-2", ts),
    ]);
    assert.ok(a);
    assert.ok(b);
    assert.equal(store.sendingCount(), 2);
  });
});
