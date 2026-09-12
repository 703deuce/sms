import assert from "node:assert/strict";
import {
  normalizeUserFacingStatus,
  statusFilterMatches,
} from "../src/lib/payment-requests/status";
import { formatMoneyMinor, parseAmountToMinor, formatPhoneDisplay } from "../src/lib/payment-requests/format";
import { buildPaymentRequestPublicUrl } from "../src/lib/payment-requests/public-url";
import { PAYMENT_REQUEST_TRANSACTION_TYPE } from "../src/lib/payment-requests/types";
import { isPaymentRequestCheckoutMetadata } from "../src/lib/payment-requests/types";

assert.equal(PAYMENT_REQUEST_TRANSACTION_TYPE, "transovo_payment_request");
assert.equal(
  isPaymentRequestCheckoutMetadata({ transaction_type: "transovo_payment_request" }),
  true,
);
assert.equal(isPaymentRequestCheckoutMetadata({ transaction_type: "other" }), false);

assert.equal(parseAmountToMinor("$125.00"), 12500);
assert.equal(parseAmountToMinor("0"), null);
assert.equal(formatMoneyMinor(12500, "usd"), "$125.00");
assert.equal(formatPhoneDisplay("+15715550123"), "(571) 555-0123");

assert.equal(normalizeUserFacingStatus("paid", "sent"), "Paid");
assert.equal(normalizeUserFacingStatus("opened", "sent"), "Opened");
assert.equal(normalizeUserFacingStatus("sent", "delivered"), "Delivered");
assert.equal(statusFilterMatches("paid", "paid", "delivered"), true);
assert.equal(statusFilterMatches("outstanding", "sent", "sent"), true);

const url = buildPaymentRequestPublicUrl("abc123");
assert.ok(url.includes("/p/abc123"));

console.log("test-payment-requests: OK");
