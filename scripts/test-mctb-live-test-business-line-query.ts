#!/usr/bin/env npx tsx
/**
 * Live test missed-call query must match business line stored as 10-digit or E.164.
 */
import assert from "node:assert/strict";
import { mctbCallerE164Variants, mctbDidE164Variants } from "../src/lib/mctb/messaging/caller-e164";

const variants = mctbDidE164Variants("5714776175");
assert.ok(variants.includes("+15714776175"), "expected normalized business line variant");
assert.ok(variants.includes("5714776175"), "expected raw stored variant");

const callerVariants = mctbCallerE164Variants("+17038166017");
assert.ok(callerVariants.includes("+17038166017"), "live test reply lookup needs caller E.164 variants");

console.log("test-mctb-live-test-business-line-query: PASS");
