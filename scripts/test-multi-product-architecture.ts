/**
 * Multi-product architecture unit checks (no browser required).
 * Run: npx tsx scripts/test-multi-product-architecture.ts
 */
import assert from "node:assert/strict";
import { buildNumbersNav } from "@/lib/products/numbers-nav";
import { buildSmsNav } from "@/lib/products/sms-nav";
import {
  isNumbersProductPath,
  isSmsProductPath,
  resolveProductFromPath,
} from "@/lib/products/paths";
import { resolvePostLoginPath } from "@/lib/products/routing";
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
assert.equal(isSmsProductPath("/campaigns"), true);
assert.equal(isNumbersProductPath("/personal/forwarding"), true);
assert.equal(isSmsProductPath("/personal"), false);

// Sidebar separation — no cross-product links in primary nav
const smsNav = buildSmsNav();
const numbersNav = buildNumbersNav();
const smsHrefs = smsNav.map((i) => i.href).join(" ");
const numbersHrefs = numbersNav.map((i) => i.href).join(" ");
assert.ok(!smsHrefs.includes("/personal/vault"), "SMS nav must not include Number Vault");
assert.ok(!numbersHrefs.includes("/campaigns"), "Numbers nav must not include Campaigns");
assert.ok(numbersHrefs.includes("/personal/vault"), "Numbers nav includes vault");
assert.ok(smsHrefs.includes("/inbox"), "SMS nav includes inbox");

console.log("test-multi-product-architecture: all checks passed");
