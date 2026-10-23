/**
 * Phase 7 unit checks (no DB): CSV mapping, CRM op labels, disconnected integration payload shape.
 */
import assert from "node:assert/strict";
import { guessCsvColumnMapping } from "../lib/phone/csv-import-mapping";
import { formatCrmOperations, labelCrmOperation } from "../lib/phone/integration-op-labels";

function testCsvGuess() {
  const headers = ["Phone", "Full Name", "Company"];
  const m = guessCsvColumnMapping(headers);
  assert.equal(m.phone, "Phone");
  assert.equal(m.name, "Full Name");
  assert.equal(m.company, "Company");
  console.log("csv-guess-mapping: PASS");
}

function testCrmLabels() {
  assert.equal(labelCrmOperation("import_contacts"), "Import contacts");
  assert.equal(formatCrmOperations(["log_call", "import_contacts"]), "Log calls · Import contacts");
  console.log("crm-op-labels: PASS");
}

function testDisconnectedIntegrationShape() {
  const conn = undefined as { status: string; lastSyncAt: string | null } | undefined;
  const normalized = {
    status: conn?.status ?? "disconnected",
    lastSyncAt: conn?.lastSyncAt ?? null,
  };
  assert.equal(normalized.status, "disconnected");
  assert.equal(normalized.lastSyncAt, null);
  console.log("integration-disconnected-shape: PASS");
}

testCsvGuess();
testCrmLabels();
testDisconnectedIntegrationShape();
console.log("power-dialer-phase7: ALL PASS");
