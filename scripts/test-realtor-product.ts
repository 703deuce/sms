/**
 * Static regression tests for Realtor product UI + auto-deploy.
 * Run: npx tsx scripts/test-realtor-product.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const pages = [
  "src/app/(app)/realtor/onboarding/page.tsx",
  "src/app/(app)/realtor/dashboard/page.tsx",
  "src/app/(app)/realtor/leads/page.tsx",
  "src/app/(app)/realtor/leads/[id]/page.tsx",
  "src/app/(app)/realtor/needs-attention/page.tsx",
  "src/app/(app)/realtor/test/page.tsx",
  "src/app/(app)/realtor/agents/front-desk/page.tsx",
  "src/app/(app)/realtor/agents/speed-to-lead/page.tsx",
  "src/app/(app)/realtor/agents/activity/page.tsx",
  "src/app/(app)/realtor/agents/knowledge/page.tsx",
  "src/app/(app)/realtor/messages/page.tsx",
  "src/app/(app)/realtor/appointments/page.tsx",
  "src/app/(app)/realtor/appointments/types/page.tsx",
  "src/app/(app)/realtor/leads/sources/page.tsx",
  "src/app/(app)/realtor/settings/business/page.tsx",
  "src/app/api/realtor/onboarding/route.ts",
  "src/app/api/realtor/dashboard/route.ts",
  "src/app/api/realtor/test-lead/route.ts",
];

for (const page of pages) {
  assert.ok(fs.existsSync(path.join(root, page)), `missing ${page}`);
}

const nav = read("src/lib/realtor/nav.ts");
assert.ok(nav.includes("Needs Attention"));
assert.ok(nav.includes("Messages"));
assert.ok(nav.includes("Agent Activity"));

const sidebar = read("src/components/layout/sidebar.tsx");
assert.ok(sidebar.includes("buildRealtorNav"));
assert.ok(sidebar.includes("realtorMode"));

const layout = read("src/app/(app)/layout.tsx");
assert.ok(layout.includes("isRealtorWorkspace"));
assert.ok(layout.includes("realtorMode"));

const onboardingApi = read("src/app/api/realtor/onboarding/route.ts");
assert.ok(onboardingApi.includes("deployRealEstateFrontDesk"));
assert.ok(onboardingApi.includes('action === "go_live"'));

const deploySpeed = read("src/lib/realtor/deploy-speed-to-lead.ts");
assert.ok(deploySpeed.includes("ensureRealtorOutboundAgent"));
assert.ok(deploySpeed.includes("ensureRealtorFollowUpAutomation"));

const testLeadApi = read("src/app/api/realtor/test-lead/route.ts");
assert.ok(testLeadApi.includes("triggerOutboundQualificationCall"));

const realtorIndex = read("src/app/(app)/realtor/page.tsx");
assert.ok(realtorIndex.includes("/realtor/onboarding"));

const wizard = read("src/components/realtor/onboarding-wizard.tsx");
assert.ok(wizard.includes("Go Live — Deploy Amy"));
assert.ok(wizard.includes("intent"));

const mobileNav = read("src/components/layout/mobile-nav.tsx");
assert.ok(mobileNav.includes("buildRealtorMobileNav"));

const appShell = read("src/components/layout/app-shell.tsx");
assert.ok(appShell.includes("getRealtorPageTitle"));

assert.ok(fs.existsSync(path.join(root, "src/lib/voice/real-estate/policy.ts")));
assert.ok(fs.existsSync(path.join(root, "src/lib/voice/real-estate/agent-templates.ts")));

console.log("realtor product tests: PASS");
