import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPaymentDestination,
  CASH_APP_PROVIDER,
  getPaymentProviderCapabilities,
  isBlockedUrl,
  PAYPAL_PROVIDER,
  STRIPE_PROVIDER,
  validatePaymentMethodInput,
  VENMO_PROVIDER,
  ZELLE_PROVIDER,
} from "./providers";

describe("payment providers", () => {
  describe("Stripe", () => {
    it("accepts buy.stripe.com links", () => {
      const r = validatePaymentMethodInput(
        "stripe",
        "https://buy.stripe.com/test_abc123"
      );
      assert.equal(r.ok, true);
    });

    it("rejects non-stripe domains", () => {
      const r = validatePaymentMethodInput("stripe", "https://evil.com/phish");
      assert.equal(r.ok, false);
    });

    it("builds destination as passthrough URL", () => {
      const url = "https://buy.stripe.com/test_abc123";
      const result = buildPaymentDestination("stripe", { publicUrl: url });
      assert.equal(result.destinationUrl, url);
    });
  });

  describe("Cash App", () => {
    it("validates cashtag", () => {
      const r = validatePaymentMethodInput("cash_app", "$localshop");
      assert.equal(r.ok, true);
    });

    it("builds destination with cashtag and amount", () => {
      const result = buildPaymentDestination("cash_app", {
        publicHandle: "$localshop",
        amountCents: 1000,
      });
      assert.equal(result.destinationUrl, "https://cash.app/localshop/10.00");
    });
  });

  describe("Venmo", () => {
    it("builds pay URL with amount", () => {
      const result = buildPaymentDestination("venmo", {
        publicHandle: "localshop",
        amountCents: 500,
      });
      assert.ok(result.destinationUrl?.includes("amount=5.00"));
    });
  });

  describe("PayPal", () => {
    it("appends amount to paypal.me URL", () => {
      const result = buildPaymentDestination("paypal", {
        publicHandle: "localshop",
        amountCents: 12500,
      });
      assert.ok(result.destinationUrl?.includes("/125.00"));
    });

    it("accepts paypal.me/handle without protocol", () => {
      const r = validatePaymentMethodInput("paypal", "paypal.me/localshop");
      assert.equal(r.ok, true);
      if (r.ok) assert.equal(r.normalized, "https://paypal.me/localshop");
    });
  });

  describe("Zelle", () => {
    it("uses manual flow", () => {
      const result = buildPaymentDestination("zelle", {
        publicHandle: "pay@localshop.com",
        amountCents: 1000,
      });
      assert.equal(result.manualFlow, true);
      assert.equal(result.destinationUrl, null);
    });
  });

  describe("capabilities", () => {
    it("marks providers as not verified", () => {
      assert.equal(getPaymentProviderCapabilities("stripe").supportsVerifiedCompletion, false);
      assert.equal(getPaymentProviderCapabilities("cash_app").supportsVerifiedCompletion, false);
    });

    it("marks Zelle without prefilled amount", () => {
      assert.equal(ZELLE_PROVIDER.capabilities.supportsPrefilledAmount, false);
      assert.equal(STRIPE_PROVIDER.capabilities.supportsExternalLink, true);
      assert.equal(CASH_APP_PROVIDER.capabilities.supportsPrefilledAmount, true);
      assert.equal(VENMO_PROVIDER.capabilities.supportsPrefilledAmount, true);
      assert.equal(PAYPAL_PROVIDER.capabilities.supportsPrefilledAmount, true);
    });

    it("blocks malicious URLs", () => {
      assert.equal(isBlockedUrl("javascript:alert(1)"), true);
    });
  });
});
