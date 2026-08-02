/**
 * Contract tests for CRM + Calendly product integration phase.
 * Run: npx tsx scripts/test-crm-product-phase.ts
 */
import assert from "node:assert/strict";
import { AUTOMATION_BLOCKS } from "../src/lib/automations/catalog";
import { INTEGRATION_AUTOMATION_TEMPLATES } from "../src/lib/automations/integration-templates";
import { INTEGRATION_EVENT_TO_TRIGGER } from "../src/lib/integrations/framework/automation-bridge";
import {
  CRM_AUTOMATION_ACTIONS,
  crmActionsForProvider,
  isCrmAutomationProvider,
} from "../src/lib/crm/automation-actions";
import { CRM_JOB_TYPES } from "../src/lib/crm/runtime/job-types";

let passed = 0;
function ok(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

ok("CRM providers recognized", () => {
  assert.equal(isCrmAutomationProvider("salesforce"), true);
  assert.equal(isCrmAutomationProvider("zoho"), true);
  assert.equal(isCrmAutomationProvider("pipedrive"), true);
  assert.equal(isCrmAutomationProvider("calendly"), false);
});

ok("CRM actions gated by feature matrix", () => {
  const sf = crmActionsForProvider("salesforce").map((a) => a.id);
  assert.ok(sf.includes("contact.upsert"));
  assert.ok(sf.includes("lead.upsert"));
  assert.ok(sf.includes("call.log"));
  const pd = crmActionsForProvider("pipedrive").map((a) => a.id);
  assert.ok(!pd.includes("lead.upsert"), "Pipedrive leads unsupported");
  assert.ok(CRM_AUTOMATION_ACTIONS.length >= 6);
});

ok("normalized CRM/Calendly events map to triggers", () => {
  assert.equal(INTEGRATION_EVENT_TO_TRIGGER["contact.created"], "integration_contact_created");
  assert.equal(INTEGRATION_EVENT_TO_TRIGGER["lead.created"], "integration_lead_created");
  assert.equal(INTEGRATION_EVENT_TO_TRIGGER["deal.won"], "integration_deal_won");
  assert.equal(
    INTEGRATION_EVENT_TO_TRIGGER["appointment.starting_soon"],
    "integration_appointment_starting_soon",
  );
});

ok("automation catalog has Integrations groups for CRM and Calendly", () => {
  const crm = AUTOMATION_BLOCKS.filter((b) => b.integrationGroup === "crm");
  const cal = AUTOMATION_BLOCKS.filter((b) => b.integrationGroup === "calendly");
  assert.ok(crm.length >= 5);
  assert.ok(cal.length >= 4);
  assert.ok(AUTOMATION_BLOCKS.some((b) => b.blockType === "integration_appointment_starting_soon"));
  assert.ok(AUTOMATION_BLOCKS.some((b) => b.blockType === "integration_action"));
});

ok("starter templates exist and never auto-bind", () => {
  assert.ok(INTEGRATION_AUTOMATION_TEMPLATES.length >= 5);
  for (const t of INTEGRATION_AUTOMATION_TEMPLATES) {
    assert.ok(t.triggerBlockType);
    assert.ok(t.suggestedActions.length >= 1);
  }
});

ok("CRM job types include automation action", () => {
  assert.ok((CRM_JOB_TYPES as readonly string[]).includes("crm_automation_action"));
});

ok("job handlers register new job types", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const src = fs.readFileSync(
    new URL("../src/lib/jobs/job-handlers.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /case "crm_automation_action"/);
  assert.match(src, /case "appointment_starting_soon_scan"/);
});

console.log(`\n${passed} tests passed`);
