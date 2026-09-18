#!/usr/bin/env npx tsx
/**
 * Voice V2 lead qualification / caller triage — headless certification.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v2-qualification-headless.ts
 */
import assert from "node:assert/strict";
import { applyWizardPreset, createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { mergeAppointmentWizardAdvanced } from "../src/lib/solutions/appointment-receptionist/wizard-advanced-bridge";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import { buildWorkflowToolPayload, deriveVoiceV2NextStage } from "../src/lib/voice-receptionist-wizard/booking-workflow";
import { getIntakeReadiness } from "../src/lib/voice-receptionist-wizard/intake/readiness";
import type { VoiceV2CallContext } from "../src/lib/voice-receptionist-wizard/intake/types";
import { compileVoiceV2IntakeSchema } from "../src/lib/voice-receptionist-wizard/intake/compile-schema";
import {
  isVoiceV2QualificationEnabled,
  qualificationConfigFromWizard,
  resolveVoiceV2QualificationConfig,
} from "../src/lib/voice-receptionist-wizard/qualification-config";
import {
  applyQualificationToContext,
  evaluateVoiceV2Qualification,
} from "../src/lib/voice-receptionist-wizard/qualification-evaluator";
import { evaluateQualificationPrimaryActionGate } from "../src/lib/voice-receptionist-wizard/qualification-gate";
import { resolveVoiceV2BookingStrategy } from "../src/lib/voice-receptionist-wizard/booking-strategy";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

let strategy: ReturnType<typeof resolveVoiceV2BookingStrategy> = "MICROSOFT_365";

function baseWizard() {
  const wizard = applyWizardPreset(createDefaultWizardState(), "after_hours");
  wizard.qualificationEnabled = true;
  wizard.qualificationRequiredBeforePrimaryAction = true;
  wizard.qualificationSupportedZipCodes = ["22191", "22192"];
  wizard.collectFields = wizard.collectFields.map((f) =>
    f.id === "custom_zip_code" || f.id.includes("zip")
      ? f
      : f.id === "service"
        ? { ...f, useForQualification: true }
        : f,
  );
  if (!wizard.collectFields.some((f) => f.id.includes("zip"))) {
    wizard.collectFields.push({
      id: "custom_zip_code",
      label: "ZIP code",
      required: true,
      enabled: true,
      useForQualification: true,
    });
  }
  wizard.qualificationRules = [];
  return wizard;
}

function wizardWithRoofRule() {
  const w = baseWizard();
  w.qualificationRules = [
    {
      id: "r1",
      fieldKey: "roof_age",
      operator: "LESS_THAN_OR_EQUAL",
      value: "8",
      resultStatus: "NOT_QUALIFIED",
      reasonCode: "OTHER_CONFIGURED_RULE",
      reasonLabel: "Roof too new for program",
    },
  ];
  return w;
}

function configForStrategy(
  strategy: "NONE" | "REQUEST_ONLY" | "SEND_LINK" | "MICROSOFT_365" | "CALENDLY",
  qualOn = true,
): VoiceAgentConfig {
  const wizard = baseWizard();
  wizard.qualificationEnabled = qualOn;
  wizard.bookingStrategy = strategy;
  wizard.capabilities = [...new Set([...wizard.capabilities, "book_appointments", "qualify_callers"])];
  if (strategy === "SEND_LINK") wizard.bookingLinkUrl = "https://book.example.com/x";
  if (strategy === "MICROSOFT_365") {
    wizard.calendarConnected = true;
    wizard.calendarProvider = "microsoft";
  }
  if (strategy === "CALENDLY") {
    wizard.calendlyEventTypeUri = "https://api.calendly.com/event_types/et-test";
    wizard.calendarConnected = true;
    wizard.calendarProvider = "calendly";
  }
  if (strategy === "NONE") {
    wizard.capabilities = wizard.capabilities.filter((c) => c !== "book_appointments");
    wizard.capabilities.push("take_messages");
  }
  const advanced = mergeAppointmentWizardAdvanced(wizard, {});
  return applyAmyMinimumSideEffectConfig({
    enabledBuiltinTools: [],
    advanced: {
      appointmentReceptionistWizard: wizard,
      ...advanced,
      conversationWorkflowMode: true,
    },
  } as VoiceAgentConfig);
}

function ctxWithIntake(
  cfg: VoiceAgentConfig,
  intake: Record<string, string>,
): VoiceV2CallContext {
  const schema = compileVoiceV2IntakeSchema(cfg);
  const qual = resolveVoiceV2QualificationConfig(cfg);
  strategy = resolveVoiceV2BookingStrategy(cfg);
  const intakeState: VoiceV2CallContext["intakeState"] = {};
  const now = new Date().toISOString();
  for (const [k, v] of Object.entries(intake)) {
    intakeState[k] = {
      value: v,
      status: "CAPTURED",
      source: "CALLER",
      updatedAt: now,
    };
  }
  const base: VoiceV2CallContext = {
    sessionKey: "test",
    workspaceId: "ws",
    agentId: "agent",
    businessTimezone: "America/New_York",
    intakeSchema: schema,
    intakeState,
    askedFields: {},
    compiledAt: now,
    capabilities: {
      qualificationEnabled: qual.qualificationEnabled,
      qualificationRequiredBeforePrimaryAction: qual.qualificationRequiredBeforePrimaryAction,
      qualificationRevision: qual.qualificationRevision,
      qualificationRules: qual.rules,
      qualificationRulesMatchMode: qual.rulesMatchMode,
      qualificationSupportedZipCodes: qual.supportedZipCodes,
      qualificationNotQualifiedFallback: qual.notQualifiedFallback,
      qualificationNeedsReviewFallback: qual.needsReviewFallback,
      qualificationFieldKeys: qual.qualificationFieldKeys,
      bookingStrategy: resolveVoiceV2BookingStrategy(cfg),
      voiceV2PstnLiveBooking: strategy === "MICROSOFT_365" || strategy === "CALENDLY",
    },
    bookingWorkflow: {
      bookingIntentActive: true,
      callbackRequested: false,
      bookingCancelled: false,
      bookingConfirmed: false,
      callerRequestFinalized: false,
      bookingLinkSent: false,
      requestedDate: "2026-09-20",
      lastFindRequestedDate: null,
      nextStage: "FIND_AVAILABILITY",
    },
  };
  return applyQualificationToContext(base, qual);
}

async function main() {
// Multi-field + service area qualified
const msCfg = configForStrategy("MICROSOFT_365", true);
strategy = "MICROSOFT_365";
const qualifiedCtx = ctxWithIntake(msCfg, {
  name: "Anthony",
  service_reason: "kitchen leak",
  zip_code: "22191",
  property_type: "townhouse",
});
assert.equal(qualifiedCtx.qualification?.status, "QUALIFIED");

const gateOk = await evaluateQualificationPrimaryActionGate({
  workspaceId: "ws",
  agentId: "agent",
  ctx: qualifiedCtx,
});
assert.equal(gateOk.allowed, true);

// Correction / outside ZIP
const qualCfg = qualificationConfigFromWizard(baseWizard());
const roofCfg = qualificationConfigFromWizard(wizardWithRoofRule());
let corrected = applyQualificationToContext(qualifiedCtx, qualCfg);
corrected = {
  ...corrected,
  intakeState: {
    ...corrected.intakeState,
    zip_code: {
      value: "22554",
      status: "CORRECTED",
      source: "CALLER",
      updatedAt: new Date().toISOString(),
    },
  },
};
corrected = applyQualificationToContext(corrected, qualCfg);
assert.equal(corrected.qualification?.status, "NOT_QUALIFIED");

const gateBlocked = await evaluateQualificationPrimaryActionGate({
  workspaceId: "ws",
  agentId: "agent",
  ctx: corrected,
});
assert.equal(gateBlocked.allowed, false);

// Custom numeric rule
const roofCtx = applyQualificationToContext(
  {
    ...qualifiedCtx,
    intakeState: {
      ...qualifiedCtx.intakeState,
      roof_age: {
        value: "5",
        status: "CAPTURED",
        source: "CALLER",
        updatedAt: new Date().toISOString(),
      },
    },
  },
  roofCfg,
);
assert.equal(roofCtx.qualification?.status, "NOT_QUALIFIED");

// Toggle off
const offCfg = configForStrategy("MICROSOFT_365", false);
assert.equal(isVoiceV2QualificationEnabled(offCfg), false);

// Composition
for (const mode of ["NONE", "REQUEST_ONLY", "SEND_LINK", "MICROSOFT_365", "CALENDLY"] as const) {
  const c = configForStrategy(mode, true);
  assert.equal(resolveVoiceV2BookingStrategy(c), mode);
  assert.equal(isVoiceV2QualificationEnabled(c), true);
}

// Stage override blocks FIND when not qualified
const readiness = getIntakeReadiness(corrected.intakeSchema, corrected.intakeState);
const payload = buildWorkflowToolPayload({
  voiceV2PstnLiveBooking: true,
  bookingStrategy: "MICROSOFT_365",
  workflow: corrected.bookingWorkflow!,
  readiness,
  hasActiveOfferSet: false,
  ctx: corrected,
});
assert.notEqual(payload.voice_v2_next_stage, "FIND_AVAILABILITY");

// Publish bridge
const adv = mergeAppointmentWizardAdvanced(baseWizard(), {});
assert.equal((adv.qualification as { qualificationEnabled: boolean }).qualificationEnabled, true);

console.log("VOICE_V2_QUALIFICATION_HEADLESS: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
