import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shareIdentityKey } from "@/lib/reporting/share-export";

describe("shareIdentityKey", () => {
  it("is stable for single scan and competitor selections", () => {
    assert.equal(
      shareIdentityKey({ reportType: "single_scan", scanBatchId: "batch-1" }),
      "single_scan:batch-1"
    );
    assert.equal(
      shareIdentityKey({
        reportType: "competitor",
        scanBatchId: "batch-1",
        selectedCompetitorKeys: ["b", "a"],
      }),
      "competitor:batch-1:a,b"
    );
  });

  it("scopes maps campaign shares by campaign id and period", () => {
    assert.equal(
      shareIdentityKey({ reportType: "maps_campaign", campaignId: "camp-1" }),
      "maps_campaign:camp-1:all"
    );
    assert.equal(
      shareIdentityKey({ reportType: "maps_campaign" }),
      "maps_campaign:default:all"
    );
    assert.equal(
      shareIdentityKey({
        reportType: "maps_campaign",
        campaignId: "camp-1",
        dateFrom: "2026-06-01",
        dateTo: "2026-06-30",
      }),
      "maps_campaign:camp-1:2026-06-01..2026-06-30"
    );
  });
});

describe("share expiry helpers", () => {
  it("treats null expiry as never expired", () => {
    // Mirrors findReusableShare / share page: null means forever.
    const expiresAt: string | null = null;
    const expired = Boolean(
      expiresAt && Number.isFinite(new Date(expiresAt).getTime()) && new Date(expiresAt).getTime() <= Date.now()
    );
    assert.equal(expired, false);
  });
});

