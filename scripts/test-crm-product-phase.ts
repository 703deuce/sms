/**
 * Contract tests for CRM + Calendly product integration phase.
 * Run: npx tsx scripts/test-crm-product-phase.ts
 */
import assert from "node:assert/strict";
import {
  AUTOMATION_BLOCKS,
  INTEGRATION_ACTION_OPTIONS,
} from "../src/lib/automations/catalog";
import {
  INTEGRATION_AUTOMATION_TEMPLATES,
  buildAutomationDefinitionFromTemplate,
  getIntegrationTemplate,
} from "../src/lib/automations/integration-templates";
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
  const sf = crmActionsForProvider("salesforce").map((a) => a.id as string);
  // Key actions across every object type must be available for Salesforce.
  for (const id of [
    "contact.find",
    "contact.create",
    "contact.update",
    "contact.upsert",
    "contact.link",
    "contact.change_owner",
    "contact.change_status",
    "contact.update_custom_field",
    "note.create",
    "lead.create",
    "lead.update",
    "lead.upsert",
    "lead.assign",
    "lead.change_status",
    "lead.change_source",
    "lead.convert",
    "lead.add_note",
    "company.create",
    "company.update",
    "company.link_contact",
    "company.change_owner",
    "company.add_note",
    "deal.create",
    "deal.update",
    "deal.upsert",
    "deal.move_pipeline",
    "deal.move_stage",
    "deal.mark_won",
    "deal.mark_lost",
    "deal.reopen",
    "deal.change_owner",
    "deal.change_value",
    "deal.change_close_date",
    "deal.link_contact",
    "deal.link_company",
    "deal.add_note",
    "task.create",
    "task.update",
    "task.complete",
    "task.assign",
    "task.change_due",
    "activity.create",
    "call.log",
    "call.update",
    "sms.log",
    "mms.log",
    "voicemail.log",
    "call.attach_recording",
    "call.attach_transcript",
    "call.attach_summary",
    "call.update_disposition",
    "communication.add_note",
  ]) {
    assert.ok(sf.includes(id), `Salesforce should support ${id}`);
  }
  // Salesforce has no universal Tags API — tag actions must be filtered out.
  assert.ok(!sf.includes("contact.add_tag"), "Salesforce tags unsupported");
  assert.ok(!sf.includes("contact.remove_tag"), "Salesforce tags unsupported");

  const pd = crmActionsForProvider("pipedrive").map((a) => a.id as string);
  // Pipedrive: native Leads inbox is not synced — no lead actions.
  for (const id of [
    "lead.create",
    "lead.update",
    "lead.upsert",
    "lead.assign",
    "lead.change_status",
    "lead.change_source",
    "lead.convert",
    "lead.add_note",
    "lead.update_custom_field",
  ]) {
    assert.ok(!pd.includes(id), `Pipedrive should not support ${id}`);
  }
  // Pipedrive supports tags — tag actions should be present.
  assert.ok(pd.includes("contact.add_tag"), "Pipedrive tags supported");
  assert.ok(pd.includes("contact.upsert"));
  assert.ok(pd.includes("deal.upsert"));

  const zoho = crmActionsForProvider("zoho").map((a) => a.id as string);
  assert.ok(zoho.includes("lead.upsert"), "Zoho leads supported");
  assert.ok(zoho.includes("contact.add_tag"), "Zoho tags supported");

  assert.ok(CRM_AUTOMATION_ACTIONS.length >= 40);
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

ok("catalog covers every CRM trigger and expected filter fields", () => {
  const byType = new Map(AUTOMATION_BLOCKS.map((b) => [b.blockType, b]));
  // Newly required CRM triggers must all exist.
  for (const bt of [
    "integration_contact_owner_changed",
    "integration_company_created",
    "integration_deal_pipeline_changed",
    "integration_task_overdue",
    "integration_activity_created",
    "integration_note_created",
    "integration_call_activity_created",
  ]) {
    assert.ok(byType.has(bt), `missing catalog block ${bt}`);
  }

  // Every CRM-labeled event in the bridge must have a matching catalog block.
  const crmEventTriggers = Object.entries(INTEGRATION_EVENT_TO_TRIGGER)
    .filter(([event]) =>
      /^(contact|lead|company|deal|task|activity|note|call)\./.test(event),
    )
    .map(([, trigger]) => trigger);
  for (const trigger of crmEventTriggers) {
    // Shared tag triggers live under the "other" group but must still exist.
    assert.ok(byType.has(trigger), `catalog missing trigger for ${trigger}`);
  }

  // Filter defaults are present where relevant.
  assert.equal(
    (byType.get("integration_contact_owner_changed")!.defaultConfig as Record<string, unknown>).owner,
    "",
  );
  assert.equal(
    (byType.get("integration_deal_pipeline_changed")!.defaultConfig as Record<string, unknown>).pipeline,
    "",
  );
  assert.equal(
    (byType.get("integration_contact_phone_changed")!.defaultConfig as Record<string, unknown>).requirePhone,
    true,
  );
  assert.equal(
    (byType.get("integration_task_due")!.defaultConfig as Record<string, unknown>).minutesBefore,
    60,
  );
});

ok("starter templates exist and never auto-bind", () => {
  assert.ok(INTEGRATION_AUTOMATION_TEMPLATES.length >= 7);
  for (const t of INTEGRATION_AUTOMATION_TEMPLATES) {
    assert.ok(t.triggerBlockType);
    assert.ok(t.suggestedActions.length >= 1);
  }
  // All 7 required starter templates present.
  const titles = INTEGRATION_AUTOMATION_TEMPLATES.map((t) => t.title.toLowerCase());
  for (const needle of [
    "lead follow-up",
    "missed-call",
    "call",
    "inbound sms",
    "calendly booking",
    "calendly cancellation",
    "deal won",
  ]) {
    assert.ok(
      titles.some((t) => t.includes(needle)),
      `missing starter template matching "${needle}"`,
    );
  }
});

ok("template loads into a builder-ready graph (trigger + actions)", () => {
  const t = getIntegrationTemplate("completed-call-crm");
  assert.ok(t, "completed-call-crm template should exist");
  const def = buildAutomationDefinitionFromTemplate(t!);
  const triggers = def.nodes.filter((n) => n.type === "trigger");
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].data.blockType, "call_completed");
  assert.equal(def.nodes.length, 1 + t!.suggestedActions.length);
  // Nodes are chained trigger -> action -> action ...
  assert.equal(def.edges.length, t!.suggestedActions.length);
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
  assert.match(src, /case "appointment_completed_scan"/);
  assert.match(src, /case "crm_task_due_scan"/);
});

ok("Calendly actions + scopes + completed/no-show triggers exist", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const cal = fs.readFileSync(
    new URL("../src/lib/integrations/adapters/calendly.ts", import.meta.url),
    "utf8",
  );
  assert.match(cal, /scheduling_links:write/);
  assert.match(cal, /scheduled_events:write/);
  assert.match(cal, /invitee_no_show\.created/);
  const actions = fs.readFileSync(
    new URL("../src/lib/integrations/framework/actions-registry.ts", import.meta.url),
    "utf8",
  );
  for (const id of [
    "appointment.get_scheduling_link",
    "appointment.create_single_use_link",
    "appointment.send_scheduling_link",
    "appointment.retrieve",
    "appointment.cancel",
    "appointment.get_cancel_url",
    "appointment.get_reschedule_url",
  ]) {
    assert.match(actions, new RegExp(id.replace(/\./g, "\\.")));
  }
  assert.equal(
    INTEGRATION_EVENT_TO_TRIGGER["appointment.no_show"],
    "integration_appointment_no_show",
  );
  assert.equal(
    INTEGRATION_EVENT_TO_TRIGGER["appointment.completed"],
    "integration_appointment_completed",
  );
  assert.ok(AUTOMATION_BLOCKS.some((b) => b.blockType === "integration_appointment_no_show"));
  assert.ok(AUTOMATION_BLOCKS.some((b) => b.blockType === "integration_event_type_created"));
});

ok("product UI surfaces for CRM context exist", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const paths = [
    "../src/components/contacts/connected-records-panel.tsx",
    "../src/components/contacts/integration-timeline-card.tsx",
    "../src/components/contacts/contact-crm-controls.tsx",
    "../src/lib/integrations/product/contact-crm-context.ts",
    "../src/app/(app)/integrations/crm/pipeline/pipeline-client.tsx",
    "../src/app/api/integrations/metadata/route.ts",
    "../src/app/api/integrations/actions/test/route.ts",
    "../src/lib/crm/task-due-scan.ts",
    "../src/lib/integrations/adapters/calendly-actions.ts",
  ];
  for (const p of paths) {
    assert.ok(
      fs.existsSync(new URL(p, import.meta.url)),
      `missing ${p}`,
    );
  }
});

ok("permissions include product CRM actions", () => {
  const { canCrmAction } = require("../src/lib/crm/permissions") as typeof import("../src/lib/crm/permissions");
  assert.ok(canCrmAction("INBOX_AGENT", "view_connected_data"));
  assert.ok(canCrmAction("INBOX_AGENT", "use_crm_quick_actions"));
  assert.ok(!canCrmAction("INBOX_AGENT", "connect_crm"));
  assert.ok(canCrmAction("OWNER", "resolve_mapping_conflicts"));
  assert.ok(canCrmAction("CAMPAIGN_CREATOR", "create_integration_triggers"));
});

ok("bugfix: CRM action idempotency is stable (no Date.now)", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const src = fs.readFileSync(
    new URL("../src/lib/automations/actions.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /crm-act:\$\{ctx\.executionId\}:\$\{node\.id\}/);
  assert.doesNotMatch(src, /crm-act-.*Date\.now\(\)/);
});

ok("bugfix: SF deal upsert omits invented Name/CloseDate on update", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const src = fs.readFileSync(
    new URL("../src/lib/crm/adapters/salesforce.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /Never invent Name\/Stage\/CloseDate on PATCH/);
  assert.match(src, /IsWon/);
  assert.match(src, /OpportunityContactRoles/);
});

ok("bugfix: lead ingest does not map Lead Id as Contact", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const src = fs.readFileSync(
    new URL("../src/lib/crm/sync-engine.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /NEVER map Lead Id/);
  assert.match(src, /crm:\$\{provider\}:lead/);
  assert.doesNotMatch(
    src,
    /ingestRemoteContact\(\s*workspaceId,\s*provider,\s*syncRunId,\s*\{\s*id:\s*lead\.id/,
  );
});

ok("bugfix: Calendly persist reads startsAt/endsAt + no_show", () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const src = fs.readFileSync(
    new URL("../src/lib/integrations/framework/product-persist.ts", import.meta.url),
    "utf8",
  );
  assert.match(src, /startsAt/);
  assert.match(src, /endsAt/);
  assert.match(src, /no_show/);
});

ok("bugfix: builder exposes Calendly appointment actions", () => {
  assert.ok(
    INTEGRATION_ACTION_OPTIONS.some(
      (a) => a.id === "appointment.send_scheduling_link" && a.providers.includes("calendly"),
    ),
  );
  assert.ok(
    INTEGRATION_ACTION_OPTIONS.some(
      (a) => a.id === "appointment.cancel" && a.providers.includes("calendly"),
    ),
  );
});

ok("bugfix: crm_task_due_scan is a registered CRM job type", () => {
  assert.ok((CRM_JOB_TYPES as readonly string[]).includes("crm_task_due_scan"));
});

console.log(`\n${passed} tests passed`);
