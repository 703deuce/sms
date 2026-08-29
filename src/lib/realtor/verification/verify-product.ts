import assert from "node:assert/strict";
import { projectFileExists, readProjectFile } from "./_read";

const REALTOR_PAGES = [
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
  "src/app/api/realtor/onboarding/route.ts",
  "src/app/api/realtor/test-lead/route.ts",
];

export function verifyRealtorProduct(): void {
  for (const page of REALTOR_PAGES) {
    assert.ok(projectFileExists(page), `missing ${page}`);
  }

  const nav = readProjectFile("src/lib/realtor/nav.ts");
  assert.ok(nav.includes("buildRealtorNav"));
  assert.ok(nav.includes("buildRealtorMobileNav"));
  assert.ok(nav.includes("getRealtorPageTitle"));

  const sidebar = readProjectFile("src/components/layout/sidebar.tsx");
  assert.ok(sidebar.includes("TRANSOVO"));
  assert.ok(sidebar.includes("realtorMode"));

  const mobileNav = readProjectFile("src/components/layout/mobile-nav.tsx");
  assert.ok(mobileNav.includes("buildRealtorMobileNav"));

  const appShell = readProjectFile("src/components/layout/app-shell.tsx");
  assert.ok(appShell.includes("getRealtorPageTitle"));

  const onboardingApi = readProjectFile("src/app/api/realtor/onboarding/route.ts");
  assert.ok(onboardingApi.includes("deployRealEstateFrontDesk"));
  assert.ok(onboardingApi.includes("onboardingStepsForConfig"));

  assert.ok(projectFileExists("src/app/api/realtor/agents/route.ts"));
  assert.ok(projectFileExists("src/lib/realtor/wizard-steps.ts"));
  assert.ok(projectFileExists("src/components/realtor/intent-field-editor.tsx"));

  const deploySpeed = readProjectFile("src/lib/realtor/deploy-speed-to-lead.ts");
  assert.ok(deploySpeed.includes("resolveOutboundTemplateAgent"));

  assert.ok(projectFileExists("src/lib/voice/real-estate/agent-templates.ts"));
  assert.ok(projectFileExists("src/lib/realtor/boot-verification.ts"));
  const instrumentation = readProjectFile("src/instrumentation.node.ts");
  assert.ok(instrumentation.includes("bootstrapRealtorVerification"));
}
