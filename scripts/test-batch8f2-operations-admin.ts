/**
 * Batch 8F-2 — operations admin cleanup static verification.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

const requiredFiles = [
  "src/components/appointments/kimi-ui/appointment-types/components/DynamicPricingRulesEditor.tsx",
  "src/components/appointments/kimi-ui/detail/components/ManageAppointmentLinkCard.tsx",
  "src/features/appointments/kimi/appointments-new/appointments-new-connected.tsx",
  "src/components/appointments/kimi-ui/appointments-new/components/appointment-form.tsx",
];

let failed = 0;
for (const rel of requiredFiles) {
  const ok = existsSync(join(ROOT, rel));
  console.log(ok ? "PASS" : "FAIL", rel);
  if (!ok) failed += 1;
}

const formSrc = readFileSync(
  join(ROOT, "src/components/appointments/kimi-ui/appointments-new/components/appointment-form.tsx"),
  "utf8",
);
if (formSrc.includes("bookingAnswers") && formSrc.includes("staffId") && formSrc.includes("dynamic-pricing")) {
  console.log("PASS staff-created appointment form wiring");
} else {
  console.log("FAIL staff-created appointment form wiring");
  failed += 1;
}

const detailApi = readFileSync(join(ROOT, "src/app/api/appointments/[id]/route.ts"), "utf8");
if (detailApi.includes("regenerate_manage_link") && detailApi.includes("ensure_manage_link")) {
  console.log("PASS manage appointment link API actions");
} else {
  console.log("FAIL manage appointment link API actions");
  failed += 1;
}

const mapDetail = readFileSync(join(ROOT, "src/features/appointments/kimi/detail/map-detail.ts"), "utf8");
if (mapDetail.includes("t.label") && mapDetail.includes("manageAppointmentUrl")) {
  console.log("PASS appointment audit timeline mapping");
} else {
  console.log("FAIL appointment audit timeline mapping");
  failed += 1;
}

const pricingEditor = readFileSync(
  join(ROOT, "src/components/appointments/kimi-ui/appointment-types/components/DynamicPricingRulesEditor.tsx"),
  "utf8",
);
if (pricingEditor.includes("day_of_week") && pricingEditor.includes("appointmentTypeIds")) {
  console.log("PASS dynamic pricing rules editor");
} else {
  console.log("FAIL dynamic pricing rules editor");
  failed += 1;
}

const bookingPlatform = readFileSync(join(ROOT, "src/lib/appointments/booking-platform.ts"), "utf8");
if (bookingPlatform.includes("staff_created")) {
  console.log("PASS staff_created booking source attribution");
} else {
  console.log("FAIL staff_created booking source attribution");
  failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nBatch 8F-2 static verification: PASS");
