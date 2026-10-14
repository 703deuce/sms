import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Share page access rules used by /reports/share/[token]. */
function canViewSharedReport(input: {
  publishStatus: string | null | undefined;
  expiresAt: string | null | undefined;
  nowMs?: number;
}): boolean {
  if (input.publishStatus === "archived" || input.publishStatus === "draft") {
    return false;
  }
  if (input.expiresAt) {
    const expires = new Date(input.expiresAt).getTime();
    if (Number.isFinite(expires) && expires <= (input.nowMs ?? Date.now())) {
      return false;
    }
  }
  return true;
}

describe("shared report access", () => {
  it("blocks draft and archived links", () => {
    assert.equal(canViewSharedReport({ publishStatus: "draft" }), false);
    assert.equal(canViewSharedReport({ publishStatus: "archived" }), false);
    assert.equal(canViewSharedReport({ publishStatus: "published" }), true);
  });

  it("blocks expired links", () => {
    assert.equal(
      canViewSharedReport({
        publishStatus: "published",
        expiresAt: "2020-01-01T00:00:00.000Z",
        nowMs: Date.parse("2026-01-01T00:00:00.000Z"),
      }),
      false
    );
  });
});
