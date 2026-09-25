#!/usr/bin/env tsx
/**
 * MCTB Pass 4 — Setup IA and consolidation contracts.
 * Run: npx tsx scripts/test-mctb-pass-4-setup-consolidation.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MCTB_SETUP_SECTIONS } from "../src/lib/mctb/setup-sections";
import { MCTB_SETUP_CANONICAL_SECTION_ORDER } from "../src/lib/mctb/setup-section-order";
import { describeMctbSenderPresentation } from "../src/lib/mctb/sender-presentation";

const navLabels = MCTB_SETUP_SECTIONS.filter((s) => s.id !== "overview").map((s) => s.id);
assert.deepEqual(navLabels, [...MCTB_SETUP_CANONICAL_SECTION_ORDER]);

const platform = describeMctbSenderPresentation("PLATFORM");
assert.match(platform.title, /Transovo-managed/i);
assert.doesNotMatch(platform.title, /PLATFORM/);

const recovery = readFileSync("src/components/mctb/setup/setup-recovery-view.tsx", "utf8");
assert.match(recovery, /Configure AI Recovery/);
assert.doesNotMatch(recovery, /Follow-up behavior/);

const textBack = readFileSync("src/components/mctb/setup/setup-text-back-view.tsx", "utf8");
assert.match(textBack, /canEditRecoveryOpener/);

const setupRoute = readFileSync("src/app/api/mctb/setup/route.ts", "utf8");
assert.match(setupRoute, /paidEntitled/);
assert.match(setupRoute, /priorRuntime.senderMode === "PLATFORM"/);

const numbersPage = readFileSync("src/app/(app)/mctb/numbers/page.tsx", "utf8");
assert.match(numbersPage, /redirect/);

const bh = readFileSync("src/app/(app)/mctb/setup/business-hours/page.tsx", "utf8");
assert.match(bh, /setupRecovery/);

console.log("test-mctb-pass-4-setup-consolidation: OK");
