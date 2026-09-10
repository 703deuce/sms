#!/usr/bin/env npx tsx
/**
 * Batch 8G-0C — convergence blocker absorption static checks.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { resolveAppointmentRouting } from "../src/lib/appointments/appointment-routing";
import { resolveRoutingDestination } from "../src/lib/appointments/routing-resolution";
import type { RoutingRule } from "../src/lib/appointments/types";

const ROOT = process.cwd();
let failed = 0;

function assert(name: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL: ${name}`);
    failed++;
  } else {
    console.log(`PASS: ${name}`);
  }
}

const rules: RoutingRule[] = [
  {
    id: "r1",
    name: "Healthcare",
    logic: "and",
    conditions: [{ field: "industry", operator: "equals", value: "Healthcare" }],
    destination: { appointmentTypeId: "type_health" },
  },
  {
    id: "r2",
    name: "Fallback sales",
    logic: "or",
    conditions: [{ field: "team", operator: "equals", value: "Sales" }],
    destination: { appointmentTypeId: "type_sales" },
  },
];

const answersMatch = { industry: "Healthcare", team: "Other" };
const answersNoMatch = { industry: "Retail", team: "Other" };

assert(
  "resolveAppointmentRouting matches resolveRoutingDestination (match)",
  resolveAppointmentRouting({ routingRules: rules }, answersMatch)?.appointmentTypeId ===
    resolveRoutingDestination(rules, answersMatch)?.appointmentTypeId,
);
assert(
  "resolveAppointmentRouting matches resolveRoutingDestination (no match)",
  resolveAppointmentRouting({ routingRules: rules }, answersNoMatch) ===
    resolveRoutingDestination(rules, answersNoMatch),
);
assert(
  "resolveAppointmentRouting preserves rule order",
  resolveAppointmentRouting({ routingRules: rules }, answersMatch)?.appointmentTypeId === "type_health",
);

const policyEditor = join(ROOT, "src/components/appointments/workspace-booking-policies-editor.tsx");
const policyCard = join(
  ROOT,
  "src/components/settings/kimi-ui/business/components/DefaultBookingPoliciesCard.tsx",
);
const businessConnected = join(ROOT, "src/features/settings/kimi/business/business-connected.tsx");
assert("workspace policy editor exists", existsSync(policyEditor));
assert("DefaultBookingPoliciesCard exists", existsSync(policyCard));
assert(
  "business settings includes DefaultBookingPoliciesCard",
  readFileSync(businessConnected, "utf8").includes("DefaultBookingPoliciesCard"),
);

const reportCard = join(
  ROOT,
  "src/components/appointments/kimi-ui/analytics/components/service-booking-report-card.tsx",
);
const analyticsClient = join(
  ROOT,
  "src/components/appointments/kimi-ui/analytics/components/analytics-client.tsx",
);
assert("ServiceBookingReportCard exists", existsSync(reportCard));
assert(
  "analytics reports section includes ServiceBookingReportCard",
  readFileSync(analyticsClient, "utf8").includes("ServiceBookingReportCard"),
);

const legacyPanel = join(ROOT, "src/components/appointments/legacy-routing-rules-panel.tsx");
const routingForms = join(
  ROOT,
  "src/components/appointments/kimi-ui/routing-forms/components/RoutingFormsClient.tsx",
);
const publicBook = join(ROOT, "src/app/api/public/book/[slug]/route.ts");
assert("LegacyRoutingRulesPanel exists", existsSync(legacyPanel));
assert(
  "Routing forms includes LegacyRoutingRulesPanel",
  readFileSync(routingForms, "utf8").includes("LegacyRoutingRulesPanel"),
);
assert(
  "public booking uses resolveAppointmentRouting",
  readFileSync(publicBook, "utf8").includes("resolveAppointmentRouting"),
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log("\nAll Batch 8G-0C static checks passed.");
