/**
 * Batch 8F-1 — commerce admin depth static verification.
 */
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

const requiredFiles = [
  "src/components/appointments/packages-admin-client.tsx",
  "src/components/appointments/memberships-admin-client.tsx",
  "src/components/appointments/gift-cards-admin-client.tsx",
  "src/components/appointments/discounts-admin-client.tsx",
  "src/app/(app)/appointments/discounts/page.tsx",
  "src/lib/appointments/service-booking/packages.ts",
  "src/lib/appointments/service-booking/package-lifecycle.ts",
  "src/lib/appointments/service-booking/coupons.ts",
];

let failed = 0;
for (const rel of requiredFiles) {
  const ok = existsSync(join(ROOT, rel));
  console.log(ok ? "PASS" : "FAIL", rel);
  if (!ok) failed += 1;
}

const packagesSrc = readFileSync(join(ROOT, "src/lib/appointments/service-booking/packages.ts"), "utf8");
if (packagesSrc.includes("readPackageLifecyclePolicy") && packagesSrc.includes("listPackageBalancesForProduct")) {
  console.log("PASS package lifecycle + purchases backend");
} else {
  console.log("FAIL package backend helpers");
  failed += 1;
}

const couponsSrc = readFileSync(join(ROOT, "src/lib/appointments/service-booking/coupons.ts"), "utf8");
if (couponsSrc.includes("previewCouponDiscount")) {
  console.log("PASS coupon preview for POS");
} else {
  console.log("FAIL coupon preview");
  failed += 1;
}

const posSrc = readFileSync(join(ROOT, "src/lib/appointments/service-booking/phase2/pos-cart.ts"), "utf8");
if (posSrc.includes("giftCode")) {
  console.log("PASS POS gift redemption at checkout");
} else {
  console.log("FAIL POS gift redemption");
  failed += 1;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nBatch 8F-1 static verification: PASS");
