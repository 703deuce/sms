#!/usr/bin/env node
/**
 * Static presence audit for Appointments zero-gap features (1–176).
 * Run: node scripts/audit-appointments-zero-gap.mjs
 * Does not replace browser UAT — flags missing routes/libs only.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

const checks = [
  { id: 49, name: "Weekly business availability", paths: ["src/app/(app)/appointments/availability/page.tsx", "src/lib/appointments/availability-engine.ts"] },
  { id: 57, name: "Slot diagnostics", paths: ["src/features/appointments/kimi/availability/SlotDiagnosticsPanel.tsx", "src/app/api/appointments/diagnostics/slots/route.ts"] },
  { id: 79, name: "Booking approval", paths: ["src/app/api/appointments/booking/approval/route.ts"] },
  { id: 83, name: "Stripe checkout", paths: ["src/lib/appointments/payment-checkout.ts", "src/lib/merchant-payments/stripe-connect.ts"] },
  { id: 89, name: "Customer pay balance", paths: ["src/app/(public)/manage/[token]/page.tsx"] },
  { id: 93, name: "Appointments list", paths: ["src/app/(app)/appointments/page.tsx"] },
  { id: 95, name: "Calendar slot-click create", paths: ["src/features/appointments/kimi/appointments-new/appointments-new-connected.tsx"] },
  { id: 96, name: "Appointment detail", paths: ["src/app/(app)/appointments/[id]/page.tsx", "src/components/appointments/kimi-ui/detail/components/AppointmentDetail.tsx"] },
  { id: 101, name: "Policy snapshot", paths: ["src/lib/appointments/policy-snapshot.ts"] },
  { id: 104, name: "Portal package usage", paths: ["src/lib/appointments/service-booking/client-portal.ts", "src/components/appointments/client-portal-public-client.tsx"] },
  { id: 105, name: "Portal payment history", paths: ["src/lib/appointments/service-booking/client-portal.ts"] },
  { id: 106, name: "Coupons", paths: ["src/lib/appointments/service-booking/coupons.ts", "src/app/api/appointments/service-booking/coupons/route.ts"] },
  { id: 109, name: "Client wallet", paths: ["src/lib/appointments/service-booking/phase2/client-wallet.ts"] },
  { id: 110, name: "Loyalty checkout", paths: ["src/lib/appointments/service-booking/phase2/loyalty.ts", "src/components/appointments/kimi-ui/public-booking-service/components/InfoStep.tsx"] },
  { id: 115, name: "Public class seat picker", paths: ["src/app/api/public/book/[slug]/classes/seats/route.ts", "src/components/appointments/public-classes-enrollment-client.tsx"] },
  { id: 111, name: "Class series", paths: ["src/app/api/appointments/service-booking/classes/route.ts"] },
  { id: 117, name: "Waitlist priority", paths: ["src/app/api/appointments/service-booking/waitlist-priority/route.ts"] },
  { id: 121, name: "Reminder sequences", paths: ["src/app/(app)/appointments/reminders/page.tsx"] },
  { id: 128, name: "Workflow list", paths: ["src/app/(app)/appointments/workflows/page.tsx"] },
  { id: 135, name: "Analytics overview", paths: ["src/app/(app)/appointments/analytics/page.tsx"] },
  { id: 143, name: "Google calendar", paths: ["src/app/(app)/integrations/page.tsx"] },
  { id: 154, name: "Outbound webhooks", paths: ["src/app/api/appointments/service-booking/webhooks/route.ts"] },
  { id: 160, name: "Meeting polls", paths: ["src/app/api/appointments/meeting-polls/route.ts"] },
  { id: 162, name: "Routing forms", paths: ["src/app/api/appointments/routing-forms/route.ts"] },
  { id: 169, name: "Payment transactions", paths: ["src/app/(app)/payments/transactions/page.tsx"] },
];

const publicBookChain = [
  "src/app/api/public/book/[slug]/route.ts",
  "src/features/appointments/kimi/public/use-public-booking-flow.ts",
  "src/components/appointments/kimi-ui/public-booking-service/components/InfoStep.tsx",
];

let fail = 0;
console.log("APPOINTMENTS ZERO-GAP STATIC AUDIT\n");

for (const c of checks) {
  const missing = c.paths.filter((p) => !exists(p));
  const ok = missing.length === 0;
  if (!ok) fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  #${c.id} ${c.name}${missing.length ? ` — missing: ${missing.join(", ")}` : ""}`);
}

const bookMissing = publicBookChain.filter((p) => !exists(p));
console.log(`\nPublic booking chain: ${bookMissing.length ? "FAIL" : "PASS"}${bookMissing.length ? ` (${bookMissing.join(", ")})` : ""}`);
if (bookMissing.length) fail++;

const memberOnly = exists("src/lib/appointments/service-booking/membership-lifecycle.ts");
console.log(`Member-only enforcement helper: ${memberOnly ? "PASS" : "FAIL"}`);
if (!memberOnly) fail++;

console.log(`\n${fail === 0 ? "All static checks passed." : `${fail} check group(s) failed.`}`);
process.exit(fail > 0 ? 1 : 0);
