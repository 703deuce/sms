/**
 * Phase 3 unit checks — CSV parse/map, campaign extended config, eligibility labels.
 * Run: cd new-app && npx tsx scripts/test-power-dialer-phase3.ts
 */
import assert from "node:assert/strict";
import { mapCsvRows, parseCsvText } from "../lib/server/phone/power-dialer/csv-import";
import { parseExtendedConfig } from "../lib/server/phone/power-dialer/campaign-extended-config";
import { reasonToUserMessage } from "../lib/server/phone/power-dialer/eligibility";

function testCsv() {
  const { headers, rows } = parseCsvText("name,phone\nJane Doe,+1 (312) 555-0100\nBad,,");
  assert.equal(headers.length, 2);
  assert.equal(rows.length, 2);
  const mapped = mapCsvRows(rows, { name: "name", phone: "phone", custom: {} });
  assert.equal(mapped[0].phones[0]?.e164?.startsWith("+"), true);
  assert.ok(mapped[1].errors.length > 0 || !mapped[1].phones[0]?.e164);
  console.log("csv-import: PASS");
}

function testExtendedConfig() {
  const cfg = parseExtendedConfig({ leadSource: "webinar", duplicateBehavior: "skip", ownerUserId: "u1" });
  assert.equal(cfg.leadSource, "webinar");
  assert.equal(cfg.duplicateBehavior, "skip");
  console.log("campaign-extended-config: PASS");
}

function testReasonLabels() {
  const msg = reasonToUserMessage("daily_cap_reached");
  assert.ok(msg.length > 5);
  console.log("eligibility-reasons: PASS");
}

testCsv();
testExtendedConfig();
testReasonLabels();
console.log("test-power-dialer-phase3: ALL PASS");
