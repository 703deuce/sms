import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseBrevoEventPayload } from "./brevo-events";

describe("brevo event payload parsing", () => {
  it("accepts single object and arrays", () => {
    assert.equal(parseBrevoEventPayload({ event: "delivered" }).length, 1);
    assert.equal(parseBrevoEventPayload([{ event: "hard_bounce" }, { event: "spam" }]).length, 2);
    assert.equal(parseBrevoEventPayload({ items: [{ event: "unsubscribed" }] }).length, 1);
    assert.equal(parseBrevoEventPayload(null).length, 0);
  });
});
