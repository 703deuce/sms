#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { isMctbUniversalChromeActive } from "../src/lib/mctb/universal-shell";
import { resolveProductSidebarNav } from "../src/lib/products/resolve-product-nav";
import { defaultProductShell } from "../src/lib/products/product-shell";
import { productHomePath } from "../src/lib/products/types";
import { mctbShellHome } from "../src/lib/products/product-shell";

assert.equal(defaultProductShell({ hasMctb: true, hasMassSms: false }), "mctb");
assert.equal(productHomePath("voice"), "/mctb");
assert.equal(mctbShellHome(), "/mctb");

const navPayments = resolveProductSidebarNav({
  pathname: "/integrations",
  multiProduct: false,
  productShell: "appointments",
  hasMctb: true,
});
assert.equal(navPayments[0]?.sectionLabel, "Missed Call Text Back");

assert.equal(isMctbUniversalChromeActive("/payments", "appointments", { hasMctb: true }), true);
assert.equal(isMctbUniversalChromeActive("/mctb", "mctb", { hasMctb: true }), true);
assert.equal(isMctbUniversalChromeActive("/appointments/overview", "mctb", { hasMctb: true }), false);
assert.equal(isMctbUniversalChromeActive("/login", "mctb", { hasMctb: true }), false);
assert.equal(isMctbUniversalChromeActive("/voice/calls", "ai_after_hours", { hasMctb: true }), true);

const navCalls = resolveProductSidebarNav({
  pathname: "/voice/calls",
  multiProduct: false,
  productShell: "mctb",
  hasMctb: true,
  hasVoice: true,
});
assert.ok(navCalls.some((i) => i.label === "Calls" && i.href === "/voice/calls"));

console.log("test-mctb-universal-shell: OK");
