import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe";

describe("unsubscribe tokens", () => {
  it("round-trips a valid message id", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const token = buildUnsubscribeToken(id, 30);
    const parsed = verifyUnsubscribeToken(token);
    assert.ok(parsed);
    assert.equal(parsed?.messageId, id);
  });

  it("rejects tampered signatures", () => {
    const token = buildUnsubscribeToken("11111111-2222-4333-8444-555555555555");
    const bad = token.slice(0, -4) + "xxxx";
    assert.equal(verifyUnsubscribeToken(bad), null);
  });
});
