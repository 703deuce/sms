/**
 * Guard: overview runtime CSS must not set display:none on bare html:has(.appt-overview-pilot).
 * Run: npx tsx scripts/test-overview-pilot-scope-css.ts
 */
import assert from "node:assert/strict";
import {
  OVERVIEW_NEUTRAL_RUNTIME_CSS,
  OVERVIEW_PILOT_SCOPE,
} from "../src/components/appointments/kimi-ui/overview/appointments-overview-neutral-runtime.ts";

assert.ok(
  OVERVIEW_PILOT_SCOPE.startsWith("(") && OVERVIEW_PILOT_SCOPE.endsWith(")"),
  "OVERVIEW_PILOT_SCOPE must be parenthesized",
);

const broken = /^html:has\(\.appt-overview-pilot\)\s*,\s*html\.appt-overview-slate-204\s/m;
assert.ok(
  !broken.test(OVERVIEW_NEUTRAL_RUNTIME_CSS),
  "runtime CSS must not contain unparenthesized dual html selectors",
);

const hideHtml = /(?:^|})\s*html:has\(\.appt-overview-pilot\)\s*\{[^}]*display:\s*none/i;
assert.ok(!hideHtml.test(OVERVIEW_NEUTRAL_RUNTIME_CSS), "runtime CSS must not hide html root");

console.log("test-overview-pilot-scope-css: ok");
