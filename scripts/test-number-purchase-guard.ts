/**
 * Number purchase guard: production must not be blocked by CI=true.
 * Run: npx tsx scripts/test-number-purchase-guard.ts
 */
import assert from "node:assert/strict";

function loadGuard() {
  delete require.cache[require.resolve("../src/lib/numbers/number-purchase-guard")];
  return require("../src/lib/numbers/number-purchase-guard") as {
    isNumberPurchaseAllowed: () => boolean;
  };
}

const saved = {
  NODE_ENV: process.env.NODE_ENV,
  CI: process.env.CI,
  ALLOW: process.env.TRANSOVO_ALLOW_NUMBER_PURCHASE,
  DISABLE: process.env.TRANSOVO_DISABLE_NUMBER_PURCHASE,
};

function restore() {
  process.env.NODE_ENV = saved.NODE_ENV;
  process.env.CI = saved.CI;
  process.env.TRANSOVO_ALLOW_NUMBER_PURCHASE = saved.ALLOW;
  process.env.TRANSOVO_DISABLE_NUMBER_PURCHASE = saved.DISABLE;
}

try {
  process.env.NODE_ENV = "production";
  process.env.CI = "true";
  delete process.env.TRANSOVO_ALLOW_NUMBER_PURCHASE;
  delete process.env.TRANSOVO_DISABLE_NUMBER_PURCHASE;
  assert.equal(loadGuard().isNumberPurchaseAllowed(), true, "production + CI must allow purchase");

  process.env.NODE_ENV = "test";
  process.env.CI = "true";
  assert.equal(loadGuard().isNumberPurchaseAllowed(), false, "test must block");

  process.env.NODE_ENV = "development";
  process.env.CI = "true";
  delete process.env.TRANSOVO_ALLOW_NUMBER_PURCHASE;
  assert.equal(loadGuard().isNumberPurchaseAllowed(), false, "dev CI without allow must block");

  process.env.TRANSOVO_ALLOW_NUMBER_PURCHASE = "1";
  assert.equal(loadGuard().isNumberPurchaseAllowed(), true, "dev CI with allow must pass");

  process.env.NODE_ENV = "production";
  process.env.TRANSOVO_DISABLE_NUMBER_PURCHASE = "1";
  assert.equal(loadGuard().isNumberPurchaseAllowed(), false, "production disable must block");

  console.log("test-number-purchase-guard: ok");
} finally {
  restore();
}
