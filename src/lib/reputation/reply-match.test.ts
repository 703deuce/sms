import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickLatestSmsBusiness, resolveSmsReplyTargets, type SmsOutboundCandidate } from "./reply-match";

function cand(
  partial: Partial<SmsOutboundCandidate> & Pick<SmsOutboundCandidate, "kind" | "id" | "businessId" | "at">
): SmsOutboundCandidate {
  return {
    organizationId: partial.organizationId ?? "org",
    ...partial,
  };
}

describe("resolveSmsReplyTargets", () => {
  it("returns nulls when nothing matches", () => {
    assert.deepEqual(resolveSmsReplyTargets(null, null), { oneOff: null, campaign: null });
  });

  it("keeps both when same business", () => {
    const oneOff = cand({
      kind: "one_off",
      id: "s1",
      businessId: "b1",
      at: "2026-01-01T12:00:00.000Z",
    });
    const campaign = cand({
      kind: "campaign",
      id: "r1",
      businessId: "b1",
      at: "2026-01-02T12:00:00.000Z",
    });
    assert.deepEqual(resolveSmsReplyTargets(oneOff, campaign), { oneOff, campaign });
  });

  it("picks only the newer outbound across tenants", () => {
    const oneOff = cand({
      kind: "one_off",
      id: "s1",
      businessId: "b1",
      at: "2026-01-01T12:00:00.000Z",
    });
    const campaign = cand({
      kind: "campaign",
      id: "r1",
      businessId: "b2",
      at: "2026-01-03T12:00:00.000Z",
    });
    assert.deepEqual(resolveSmsReplyTargets(oneOff, campaign), {
      oneOff: null,
      campaign,
    });
  });

  it("prefers one-off when newer across tenants", () => {
    const oneOff = cand({
      kind: "one_off",
      id: "s1",
      businessId: "b1",
      at: "2026-01-05T12:00:00.000Z",
    });
    const campaign = cand({
      kind: "campaign",
      id: "r1",
      businessId: "b2",
      at: "2026-01-03T12:00:00.000Z",
    });
    assert.deepEqual(resolveSmsReplyTargets(oneOff, campaign), {
      oneOff,
      campaign: null,
    });
  });
});

describe("pickLatestSmsBusiness", () => {
  it("returns null for empty", () => {
    assert.equal(pickLatestSmsBusiness([]), null);
  });

  it("picks most recent business", () => {
    const best = pickLatestSmsBusiness([
      { businessId: "a", organizationId: "oa", at: "2026-01-01T00:00:00.000Z" },
      { businessId: "b", organizationId: "ob", at: "2026-01-03T00:00:00.000Z" },
      { businessId: "c", organizationId: "oc", at: "2026-01-02T00:00:00.000Z" },
    ]);
    assert.deepEqual(best, { businessId: "b", organizationId: "ob" });
  });
});
