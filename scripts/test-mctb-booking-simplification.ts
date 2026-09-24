#!/usr/bin/env tsx
/**
 * MCTB booking simplification — nav removal, redirects, booking links, conversations.
 * Run: npx tsx scripts/test-mctb-booking-simplification.ts
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildMctbV1Nav } from "../src/lib/products/mctb-nav";
import { collectNavHrefs } from "../src/lib/nav";
import { MCTB_ROUTES } from "../src/lib/mctb/routes";
import {
  resolveRemovedMctbSchedulingRedirect,
  MCTB_REMOVED_SCHEDULING_REDIRECTS,
} from "../src/lib/mctb/removed-scheduling-routes";
import { validateBookingLinkUrl, bookingLinkHostname } from "../src/lib/mctb/booking-links/validate-url";
import { findBestNavMatch } from "../src/lib/nav-active";
import { mapProductionNavToKimi } from "../src/components/kimi/sidebar/map-nav";

const navLabels = buildMctbV1Nav({ hasVoice: false }).map((i) => i.label);
const navHrefs = collectNavHrefs(buildMctbV1Nav({ hasVoice: false }));

// —— Removals (38–41) ——
for (const label of ["Calendar", "Appointments", "Booking Setup", "Reminders"]) {
  assert.ok(!navLabels.includes(label), `nav must not include ${label}`);
}
assert.ok(navLabels.includes("Inbox"));
assert.ok(!navLabels.includes("Conversations"));
assert.equal(navLabels.filter((l) => l === "Overview").length, 1);

// —— Redirect map ——
assert.equal(resolveRemovedMctbSchedulingRedirect("/mctb/calendar"), MCTB_ROUTES.conversations);
assert.equal(resolveRemovedMctbSchedulingRedirect("/mctb/appointments/new"), MCTB_ROUTES.conversations);
assert.equal(resolveRemovedMctbSchedulingRedirect("/mctb/booking/types"), MCTB_ROUTES.setupRecovery);
assert.equal(resolveRemovedMctbSchedulingRedirect("/mctb/reminders"), MCTB_ROUTES.setupRecovery);

const redirectPages = [
  "src/app/(app)/mctb/calendar/page.tsx",
  "src/app/(app)/mctb/appointments/page.tsx",
  "src/app/(app)/mctb/booking/page.tsx",
  "src/app/(app)/mctb/reminders/page.tsx",
];
for (const p of redirectPages) {
  const src = readFileSync(p, "utf8");
  assert.ok(src.includes("resolveRemovedMctbSchedulingRedirect"), `${p} must redirect`);
  assert.ok(!src.includes("MctbCalendarConnected"), `${p} must not mount calendar UI`);
}

// —— Booking link model + API ——
assert.ok(existsSync("src/lib/mctb/booking-links/service.ts"));
assert.ok(existsSync("src/app/api/mctb/booking-links/route.ts"));
const schema = readFileSync("prisma/schema.prisma", "utf8");
assert.ok(schema.includes("model MctbBookingLink"), "prisma MctbBookingLink");
assert.ok(!schema.includes("model MctbAppointment"), "no parallel MCTB appointment model");

// —— URL validation (6) ——
assert.equal(validateBookingLinkUrl("").ok, false);
assert.equal(validateBookingLinkUrl("ftp://x.com").ok, false);
const good = validateBookingLinkUrl("https://calendly.com/acme/30min");
assert.equal(good.ok, true);
if (good.ok) assert.equal(bookingLinkHostname(good.url), "calendly.com");

// —— Conversations send flow ——
const convActions = readFileSync("src/components/mctb/booking/conversation-booking-actions.tsx", "utf8");
assert.ok(convActions.includes("/api/mctb/booking-links"));
assert.ok(convActions.includes("send_booking_link"));
assert.ok(convActions.includes("Send booking link"));
assert.ok(!convActions.includes("MCTB_ROUTES.appointmentsNew"));
assert.ok(!convActions.includes("/api/appointments/types"));

// —— Setup recovery wiring ——
const recovery = readFileSync("src/components/mctb/setup/setup-recovery-view.tsx", "utf8");
assert.ok(recovery.includes("MctbSetupBookingSection"));
const setupBooking = readFileSync("src/components/mctb/setup/mctb-setup-booking-section.tsx", "utf8");
assert.ok(setupBooking.includes("Add booking link"));
assert.ok(setupBooking.includes("Include booking link in initial recovery"));
assert.ok(setupBooking.includes("AI Booking"));

// —— Full scheduler preserved (43) ——
assert.ok(existsSync("src/app/(app)/appointments/page.tsx"));
const apptPage = readFileSync("src/app/(app)/appointments/page.tsx", "utf8");
assert.ok(!apptPage.includes('redirect("/mctb/appointments")'), "canonical appointments not replaced by MCTB route");

// —— Docs ——
assert.ok(existsSync("docs/MCTB-BOOKING-SIMPLIFICATION-AUDIT.md"));
assert.ok(existsSync("docs/MCTB-AI-BOOKING-PROVIDER-MATRIX.md"));
assert.ok(existsSync("docs/MCTB-AI-BOOKING-ARCHITECTURE.md"));
assert.ok(existsSync("src/lib/mctb/ai-booking/service.ts"));

// —— Nav match: removed paths should not highlight calendar nav ——
const kimi = mapProductionNavToKimi(buildMctbV1Nav({ hasVoice: false }));
assert.equal(findBestNavMatch(kimi, "/mctb/setup/recovery")?.href, "/mctb/setup");
assert.equal(findBestNavMatch(kimi, "/integrations")?.href, "/integrations");

// —— Audit flags ——
const audit = readFileSync("docs/MCTB-BOOKING-SIMPLIFICATION-AUDIT.md", "utf8");
assert.ok(audit.includes("FULL_SCHEDULER_BACKEND_DELETED = NO"));
assert.ok(audit.includes("MCTB_INTERNAL_CALENDAR_UI = 0"));

console.log("test-mctb-booking-simplification: OK");
