/**
 * Batch 8G-1 — static checks for legacy route redirects and internal link migration.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  COMMERCE_SECTION_REDIRECTS,
  RETIRED_APPOINTMENTS_ROUTES,
  STATIC_LEGACY_REDIRECTS,
  resolveLegacyAppointmentsRedirect,
} from "../src/lib/products/appointments-legacy-redirects";

const ROOT = join(import.meta.dirname, "..");
const SRC = join(ROOT, "src");

function assert(label: string, ok: boolean) {
  if (!ok) {
    console.error(`FAIL: ${label}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function walk(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules" || name === "kimi-drafts") continue;
      walk(p, files);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      files.push(p);
    }
  }
  return files;
}

// Redirect resolver smoke tests
assert(
  "commerce default → packages",
  resolveLegacyAppointmentsRedirect("/appointments/commerce") === "/appointments/packages",
);
assert(
  "commerce section=memberships",
  resolveLegacyAppointmentsRedirect("/appointments/commerce", { section: "memberships" }) ===
    "/appointments/memberships",
);
assert(
  "policies → settings anchor",
  resolveLegacyAppointmentsRedirect("/appointments/policies") ===
    "/settings/business#booking-policies",
);
assert(
  "routing → routing-forms",
  resolveLegacyAppointmentsRedirect("/appointments/routing") === "/appointments/routing-forms",
);
assert(
  "service-booking report preserves from/to",
  resolveLegacyAppointmentsRedirect("/appointments/reports/service-booking", {
    from: "2026-01-01",
    to: "2026-01-31",
  }).includes("from=2026-01-01"),
);

// Every retired route page should use legacy redirect helper
const retiredPages = [
  "src/app/(app)/appointments/commerce/page.tsx",
  "src/app/(app)/appointments/policies/page.tsx",
  "src/app/(app)/appointments/routing/page.tsx",
  "src/app/(app)/appointments/service-booking/page.tsx",
  "src/app/(app)/appointments/booking/share/page.tsx",
];
for (const rel of retiredPages) {
  const content = readFileSync(join(ROOT, rel), "utf8");
  assert(`${rel} uses redirect helper`, content.includes("legacyAppointmentsRedirectPage"));
}

// Internal production links should not target retired routes (except redirect pages + redirect module)
const legacyPathPatterns = [
  "/appointments/commerce",
  "/appointments/policies",
  "/appointments/routing",
  "/appointments/recall-campaigns",
  "/appointments/no-show-recovery",
  "/appointments/reports/service-booking",
  "/appointments/booking/share",
  "/appointments/booking/branding",
  "/appointments/voice-reminders",
];

const allowlistSubstrings = [
  "legacyAppointmentsRedirectPage",
  "appointments-legacy-redirects",
  "resolveLegacyAppointmentsRedirect",
  "STATIC_LEGACY_REDIRECTS",
  "RETIRED_APPOINTMENTS_ROUTES",
  "test-batch8g1",
  "reconcile-appointments",
];

const violations: string[] = [];
for (const file of walk(SRC)) {
  if (file.includes("/app/(app)/appointments/") && file.endsWith("/page.tsx")) {
    const rel = file.replace(ROOT + "/", "");
    if (
      RETIRED_APPOINTMENTS_ROUTES.some((r) => rel.includes(r.replace("/appointments/", ""))) ||
      rel.includes("commerce/page.tsx") ||
      STATIC_LEGACY_REDIRECTS["/" + rel.replace("src/app/(app)", "").replace("/page.tsx", "")]
    ) {
      continue;
    }
  }
  const content = readFileSync(file, "utf8");
  if (allowlistSubstrings.some((s) => content.includes(s))) continue;
  for (const pattern of legacyPathPatterns) {
    const hrefPatterns = [
      `href: "${pattern}"`,
      `href: '${pattern}'`,
      `href: \`${pattern}\``,
      `href="${pattern}"`,
      `href='${pattern}'`,
    ];
    if (hrefPatterns.some((hp) => content.includes(hp))) {
      violations.push(`${file.replace(ROOT + "/", "")}: ${pattern}`);
    }
  }
}

assert(
  `no internal legacy nav links (${violations.length} violations)`,
  violations.length === 0,
);
if (violations.length > 0) {
  console.error(violations.slice(0, 20).join("\n"));
}

// Nav checks
const nav = readFileSync(join(ROOT, "src/lib/products/appointments-nav.ts"), "utf8");
assert(
  "nav has no service-booking report href",
  !nav.includes('href: "/appointments/reports/service-booking"'),
);
assert("nav share uses booking section", nav.includes("/appointments/booking?section=share"));

// Policy anchor
const policyCard = readFileSync(
  join(ROOT, "src/components/settings/kimi-ui/business/components/DefaultBookingPoliciesCard.tsx"),
  "utf8",
);
assert("DefaultBookingPoliciesCard has booking-policies id", policyCard.includes('id="booking-policies"'));

// Commerce section map complete
assert(
  "commerce section map has packages",
  Boolean(COMMERCE_SECTION_REDIRECTS.packages),
);

if (process.exitCode) {
  console.error("\nBatch 8G-1 static checks failed.");
  process.exit(process.exitCode);
} else {
  console.log("\nAll Batch 8G-1 static checks passed.");
}
