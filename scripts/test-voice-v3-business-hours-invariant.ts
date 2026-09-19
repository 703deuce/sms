#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import { compileBusinessHoursAmyDisplay } from "../src/lib/voice-v3/config/business-hours-display";
import { businessHoursWindowFromWeeklySchedule } from "../src/lib/voice-v3/config/business-hours-from-wizard";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { ensureWizardOperatingMaturity } from "../src/lib/solutions/appointment-receptionist/operating-maturity-wizard";

function run(): void {
  const wizard = createDefaultWizardState();
  wizard.knowledgeItems = wizard.knowledgeItems.map((k) =>
    k.id === "hours"
      ? {
          ...k,
          summary: "We are usually open around 8ish",
          status: "complete",
          statusLabel: "Configured",
        }
      : k,
  );
  const maturity = ensureWizardOperatingMaturity(wizard);
  const display = compileBusinessHoursAmyDisplay({
    structuredSchedule: maturity.businessSchedule,
    hoursKnowledgeProse: "We are usually open around 8ish",
  });
  assert.ok(display.hoursDisplay?.includes("Monday"), "Amy hours must come from structured schedule");
  assert.equal(display.hoursProseConflictsWithStructured, true);

  const window = businessHoursWindowFromWeeklySchedule(maturity.businessSchedule, {
    weekdays: [1, 2, 3, 4, 5],
    startLocal: "09:00",
    endLocal: "17:00",
  });
  assert.notEqual(window.startLocal, "08ish");

  const config = compileVoiceV3AgentConfig({ wizard });
  assert.ok(config.business.hoursStructuredMeta?.hoursProseConflictsWithStructured);
  assert.ok(config.business.hoursDisplay?.includes("Monday"));
  assert.equal(config.business.hoursDisplay?.includes("8ish"), false);

  console.log("VOICE_V3_BUSINESS_HOURS_INVARIANT: PASS");
}

run();
