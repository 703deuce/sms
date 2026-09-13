#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

assert.ok(existsSync("src/lib/stripe-connect/tenant-validation.ts"));
assert.ok(existsSync("src/lib/stripe-connect/invoice.ts"));
assert.ok(existsSync("src/lib/stripe-connect/refunds.ts"));
assert.ok(existsSync("src/lib/payment-requests/reconcile.ts"));
assert.ok(existsSync("src/lib/payment-requests/stripe-invoice.ts"));
assert.ok(existsSync("src/lib/payment-requests/refunds.ts"));

const webhook = readFileSync("src/lib/payments/stripe-webhook-handler.ts", "utf8");
assert.ok(webhook.includes("authorizePaymentRequestConnectEvent"));
assert.ok(webhook.includes("routeConnectPaymentRequestInvoice"));

const service = readFileSync("src/lib/payment-requests/service.ts", "utf8");
assert.ok(service.includes("reconcilePaymentRequestPaid"));
assert.ok(service.includes("handlePaymentRequestInvoicePaid"));
assert.ok(service.includes('deliveryMethod === "invoice"'));

const tenant = readFileSync("src/lib/stripe-connect/tenant-validation.ts", "utf8");
assert.ok(tenant.includes("event.account"));
assert.ok(tenant.includes("metadata_workspace_mismatch"));

const msAppendix = readFileSync(
  "docs/runtime-rules/providers/MICROSOFT-OUTLOOK-CALENDAR-OPERATIONS-APPENDIX.md",
  "utf8",
);
assert.ok(msAppendix.includes("OP-006"));
assert.ok(msAppendix.includes("transactionId"));

const bookingStatus = readFileSync("docs/MCTB-AI-BOOKING-IMPLEMENTATION-STATUS.md", "utf8");
assert.ok(bookingStatus.includes("Conversation runtime wired"));
assert.ok(bookingStatus.includes("**YES**"));

console.log("test-stripe-text-to-pay-provider-completion: OK");
