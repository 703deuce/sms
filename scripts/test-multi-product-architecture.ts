/**
 * Multi-product architecture unit checks (no browser required).
 * Run: npx tsx scripts/test-multi-product-architecture.ts
 */
import assert from "node:assert/strict";
import { buildNumbersNav } from "@/lib/products/numbers-nav";
import { buildSmsNav } from "@/lib/products/sms-nav";
import {
  isNumbersMarketplacePath,
  isSmsLegacyHidden,
  isSmsShellRoute,
  SMS_CREATE_ACTIONS,
  SMS_SIDEBAR_HREFS,
} from "@/lib/products/sms-routes";
import {
  isNumbersProductPath,
  isSmsProductPath,
  resolveProductFromPath,
} from "@/lib/products/paths";
import { resolvePostLoginPath, productAccessDeniedRedirect } from "@/lib/products/routing";
import type { UserProductAccess } from "@/lib/products/types";

function access(partial: Partial<UserProductAccess> & Pick<UserProductAccess, "hasSms" | "hasNumbers">): UserProductAccess {
  return {
    products: [],
    lastActiveProduct: null,
    productIntent: null,
    ...partial,
  };
}

// SMS-only login routing
assert.equal(
  resolvePostLoginPath(access({ hasSms: true, hasNumbers: false })),
  "/dashboard",
);

// Numbers-only login routing
assert.equal(
  resolvePostLoginPath(access({ hasSms: false, hasNumbers: true })),
  "/personal",
);

// Multi-product with last active
assert.equal(
  resolvePostLoginPath(
    access({ hasSms: true, hasNumbers: true, lastActiveProduct: "numbers" }),
  ),
  "/personal",
);

// Multi-product without last active → launcher
assert.equal(
  resolvePostLoginPath(access({ hasSms: true, hasNumbers: true })),
  "/app",
);

// Deep link preserved
assert.equal(
  resolvePostLoginPath(access({ hasSms: true, hasNumbers: false }), {
    nextPath: "/sms/campaigns/123",
  }),
  "/sms/campaigns/123",
);

// Path detection
assert.equal(resolveProductFromPath("/inbox"), "sms");
assert.equal(resolveProductFromPath("/personal/vault"), "numbers");
assert.equal(resolveProductFromPath("/app"), null);
assert.equal(resolveProductFromPath("/numbers/premium"), "numbers");
assert.equal(isSmsProductPath("/campaigns"), true);
assert.equal(isSmsProductPath("/send/quick"), true);
assert.equal(isSmsProductPath("/numbers/premium"), false);
assert.equal(isNumbersProductPath("/personal/forwarding"), true);
assert.equal(isNumbersProductPath("/numbers/buy"), false);
assert.equal(isSmsLegacyHidden("/outcomes"), true);
assert.equal(isSmsShellRoute("/compliance/brand"), true);
assert.equal(isSmsShellRoute("/outcomes"), false);
assert.equal(isNumbersMarketplacePath("/numbers/premium"), true);

// Sidebar separation — no cross-product links in primary nav
const smsNav = buildSmsNav();
const numbersNav = buildNumbersNav();
const smsLabels = smsNav.map((i) => i.label);
const smsHrefs = smsNav.map((i) => i.href).join(" ");
const numbersHrefs = numbersNav.map((i) => i.href).join(" ");
assert.ok(!smsHrefs.includes("/personal/vault"), "SMS nav must not include Number Vault");
assert.ok(!numbersHrefs.includes("/campaigns"), "Numbers nav must not include Campaigns");
assert.ok(numbersHrefs.includes("/personal/vault"), "Numbers nav includes vault");
assert.ok(smsHrefs.includes("/inbox"), "SMS nav includes inbox");
assert.ok(smsLabels.includes("Grow"), "SMS nav includes Grow");
assert.ok(smsLabels.includes("Reports"), "SMS nav includes Reports");
assert.ok(!smsLabels.includes("Missed Call Text Back"), "MCTB not top-level in SMS nav");
assert.ok(!smsLabels.includes("AI Agents"), "AI Agents hidden from SMS nav for now");
assert.equal(smsNav.length, 10, "SMS sidebar ships 10 items");
assert.equal(SMS_SIDEBAR_HREFS.length, 10);
assert.ok(SMS_CREATE_ACTIONS.length >= 5, "Create menu has primary actions");

assert.equal(
  productAccessDeniedRedirect("/dashboard", { hasSms: false, hasNumbers: true }),
  null,
  "SMS preview allows dashboard without entitlement",
);
assert.equal(
  productAccessDeniedRedirect("/personal/vault", { hasSms: true, hasNumbers: false }),
  "/personal/numbers/premium",
  "Numbers paths still gate without entitlement",
);

console.log("test-multi-product-architecture: all checks passed");
