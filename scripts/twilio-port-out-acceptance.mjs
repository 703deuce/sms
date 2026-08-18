#!/usr/bin/env node
/**
 * Twilio subaccount port-out acceptance report.
 *
 * Usage:
 *   WORKSPACE_ID=... PHONE_NUMBER_ID=... npx tsx scripts/twilio-port-out-acceptance.mjs
 *
 * Optional:
 *   CONFIGURE_WEBHOOK=1  — register PortOutPhoneNumberCompleted webhook on parent account
 */
import { buildTwilioPortOutAcceptanceReport, ensureTwilioPortOutWebhookConfigured } from "../src/lib/numbers/twilio-port-out-service.ts";

const workspaceId = process.env.WORKSPACE_ID?.trim();
const phoneNumberId = process.env.PHONE_NUMBER_ID?.trim();

if (!workspaceId || !phoneNumberId) {
  console.error("Set WORKSPACE_ID and PHONE_NUMBER_ID");
  process.exit(1);
}

if (process.env.CONFIGURE_WEBHOOK === "1") {
  const configured = await ensureTwilioPortOutWebhookConfigured();
  console.log("Webhook configure:", configured ?? "skipped (no public APP_URL)");
}

const report = await buildTwilioPortOutAcceptanceReport(workspaceId, phoneNumberId);
console.log(JSON.stringify(report, null, 2));

const failures = [];
if (!report.subaccountSidPresent) failures.push("missing_subaccount_sid");
if (report.parentAccountExposed) failures.push("parent_account_exposed");
if (!report.accountNumberForCarrier) failures.push("missing_account_number");
if (!report.pinPresent || report.pinLength !== 5) failures.push("invalid_pin");

if (failures.length) {
  console.error("ACCEPTANCE FAIL:", failures.join(", "));
  process.exit(2);
}

console.log("ACCEPTANCE PASS: Twilio port-out packet fields ready for carrier submission");
