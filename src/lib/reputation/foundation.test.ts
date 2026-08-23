import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderTemplate } from "./template-vars";
import { normalizePhoneE164, isSmsOptOutMessage } from "./phone";
import {
  contactIdentity,
  labelReviewAttribution,
  normalizeEmail,
} from "./contacts-normalize";
import {
  evaluateSequenceCondition,
  isQuietHour,
  isWithinSendingWindow,
} from "./sequence-engine";
import {
  findUnknownTemplateTokens,
  validateReviewTemplateLanguage,
} from "./template-compliance";

describe("template tokens", () => {
  it("renders known tokens", () => {
    assert.equal(
      renderTemplate("Hi {{first_name}} — {{business_name}}", {
        first_name: "Sam",
        business_name: "Acme",
      }),
      "Hi Sam — Acme"
    );
  });

  it("flags unknown tokens", () => {
    assert.deepEqual(findUnknownTemplateTokens("Hi {{first_name}} {{bogus}}"), ["bogus"]);
  });
});

describe("normalization", () => {
  it("normalizes US phones to e164", () => {
    assert.equal(normalizePhoneE164("(555) 123-4567"), "+15551234567");
  });

  it("normalizes emails", () => {
    assert.equal(normalizeEmail("  Sam@Example.COM "), "sam@example.com");
    assert.equal(normalizeEmail("not-an-email"), null);
  });

  it("builds contact identity", () => {
    const id = contactIdentity({ phone: "5551234567", email: "A@B.com" });
    assert.equal(id.phoneE164, "+15551234567");
    assert.equal(id.emailNormalized, "a@b.com");
  });
});

describe("opt-out", () => {
  it("detects STOP variants", () => {
    assert.equal(isSmsOptOutMessage("stop"), true);
    assert.equal(isSmsOptOutMessage("STOPALL"), true);
    assert.equal(isSmsOptOutMessage("hello"), false);
  });
});

describe("quiet hours / send window", () => {
  it("treats outside window as quiet", () => {
    const night = new Date("2026-01-14T03:30:00.000Z"); // 22:30 EST
    assert.equal(isWithinSendingWindow(night, "America/New_York", "10:00", "18:00"), false);
    assert.equal(isQuietHour(night, "America/New_York", "10:00", "18:00"), true);
  });
});

describe("sequence conditions", () => {
  it("evaluates no_activity and opt-out", () => {
    const facts = {
      delivered: true,
      clicked: false,
      replied: false,
      optedOut: false,
      reviewDetected: false,
      hasPhone: true,
      hasEmail: false,
    };
    assert.equal(evaluateSequenceCondition("no_activity", facts), true);
    assert.equal(evaluateSequenceCondition("customer_opted_out", { ...facts, optedOut: true }), true);
    assert.equal(evaluateSequenceCondition("valid_email", facts), false);
  });
});

describe("attribution labels", () => {
  it("never confirms without approved identifier", () => {
    assert.equal(
      labelReviewAttribution({
        hasUniqueTrackedClick: true,
        hasApprovedIdentifier: false,
        hoursSinceClick: 12,
      }),
      "likely"
    );
    assert.equal(
      labelReviewAttribution({
        hasUniqueTrackedClick: true,
        hasApprovedIdentifier: true,
        hoursSinceClick: 12,
      }),
      "confirmed"
    );
    assert.equal(
      labelReviewAttribution({
        hasUniqueTrackedClick: false,
        hasApprovedIdentifier: false,
        hoursSinceClick: null,
      }),
      "unattributed"
    );
  });
});

describe("template compliance", () => {
  it("warns on five-star-only copy", () => {
    const warnings = validateReviewTemplateLanguage("Please leave us a five-star review");
    assert.ok(warnings.length >= 1);
  });
});
