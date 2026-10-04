#!/usr/bin/env npx tsx
/**
 * Ensures ensureMctbWorkspaceSeeded never resets canonical mctb.consentMode.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync("src/lib/mctb/provisioning/seed-workspace.ts", "utf8");

assert.match(src, /storedMctbConsent/);
assert.match(src, /canonicalConsent/);
assert.doesNotMatch(
  src,
  /consentMode:\s*onboardingSeed\.consentMode\s*\|\|\s*["']press_1["']/,
);
assert.match(src, /consentMode:\s*canonicalConsent/);

console.log("test-mctb-seed-workspace-consent: PASS");
