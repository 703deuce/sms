#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { isMctbProductChromePath, isMctbNeutralShellPath } from "../src/lib/products/mctb-shell";
import { findBestNavMatch } from "../src/lib/nav-active";
import { buildMctbV1Nav } from "../src/lib/products/mctb-nav";
import { mapProductionNavToKimi } from "../src/components/kimi/sidebar/map-nav";

assert.equal(isMctbNeutralShellPath("/mctb/setup/phone"), true);
assert.equal(isMctbProductChromePath("/payments", "mctb"), true);
assert.equal(isMctbProductChromePath("/payments", "appointments"), false);
assert.equal(isMctbProductChromePath("/integrations", "mctb"), true);

const kimi = mapProductionNavToKimi(buildMctbV1Nav());
const nested: Array<[string, string]> = [
  ["/mctb/missed-calls/abc", "/mctb/missed-calls"],
  ["/mctb/conversations", "/mctb/conversations"],
  ["/mctb/voicemail/inbox", "/mctb/voicemail"],
  ["/mctb/analytics/overview", "/mctb/analytics"],
  ["/mctb/setup/phone", "/mctb/setup"],
  ["/mctb/calendar/week", "/mctb/calendar"],
  ["/mctb/appointments/new", "/mctb/appointments"],
  ["/mctb/booking/types", "/mctb/booking"],
  ["/mctb/reminders/rules", "/mctb/reminders"],
  ["/payments/requests", "/payments"],
  ["/integrations", "/integrations"],
];

for (const [pathname, expectedHref] of nested) {
  const match = findBestNavMatch(kimi, pathname);
  assert.equal(match?.href, expectedHref, `${pathname} → ${expectedHref}`);
}

const overviewOnly = findBestNavMatch(kimi, "/mctb");
assert.equal(overviewOnly?.href, "/mctb");

console.log("test-mctb-product-chrome: OK");
