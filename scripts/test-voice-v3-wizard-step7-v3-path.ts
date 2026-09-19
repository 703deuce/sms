#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function run(): void {
  const testStep = readFileSync(
    join(process.cwd(), "src/components/solutions/appointment-receptionist/steps/test-step.tsx"),
    "utf8",
  );
  assert.ok(testStep.includes("VoiceV3BrowserCall"), "Step 7 must use VoiceV3BrowserCall");
  assert.ok(!testStep.includes("AgentBrowserCall"), "Step 7 must not use Telnyx AgentBrowserCall");
  assert.ok(!testStep.includes("build_for_test"), "Step 7 must not sync Telnyx build_for_test");

  const routePath = join(
    process.cwd(),
    "src/app/api/voice/agents/[id]/v3-wizard-live-test/route.ts",
  );
  assert.ok(readFileSync(routePath, "utf8").includes("createWizardV3BrowserLiveTest"));

  console.log("VOICE_V3_WIZARD_STEP7_V3_PATH_STATIC: PASS");
}

run();
