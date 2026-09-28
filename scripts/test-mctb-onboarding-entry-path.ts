#!/usr/bin/env tsx
import assert from "node:assert/strict";

function loadEntryPath() {
  process.env.NEXT_PUBLIC_NEWUI_SHELL = "1";
  delete require.cache[require.resolve("../src/lib/mctb/onboarding/entry-path")];
  return require("../src/lib/mctb/onboarding/entry-path") as typeof import("../src/lib/mctb/onboarding/entry-path");
}

process.env.NEXT_PUBLIC_NEWUI_STAGE2 = "1";
const stage2 = loadEntryPath();
assert.equal(stage2.mctbOnboardingEntryPath(), "/mctb");
assert.equal(stage2.normalizeMctbOnboardingPostLoginPath("/onboarding/mctb"), "/mctb");

process.env.NEXT_PUBLIC_NEWUI_STAGE2 = "0";
const legacy = loadEntryPath();
assert.equal(legacy.mctbOnboardingEntryPath(), "/onboarding/mctb");

console.log("test-mctb-onboarding-entry-path: OK");
