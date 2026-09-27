#!/usr/bin/env npx tsx
/**
 * Voice V3 eight-step configuration → published runtime (contract layer).
 * Does NOT replace live PSTN certification — proves compiler/tool/publish-resolution boundaries.
 */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileVoiceV3AgentConfig } from "../src/lib/voice-v3/config/compile-voice-v3-agent-config";
import { resolveWizardSnapshotForVoiceV3 } from "../src/lib/voice-v3/config/resolve-wizard-snapshot-for-v3";
import { createDefaultWizardState } from "../src/lib/solutions/appointment-receptionist/defaults";
import { mergeWizardStateForSave } from "../src/lib/solutions/appointment-receptionist/merge-wizard-state-on-save";
import {
  isVoiceV3ToolAuthorized,
  authorizeVoiceV3ToolOrError,
} from "../src/lib/voice-v3/tools/authorize-tool-for-config";
import { listVoiceV3AstraToolNamesForConfig } from "../src/lib/voice-v3/tools/voice-tool-catalog";
import { buildVoiceV3Prompts } from "../src/lib/voice-v3/prompts/build-voice-v3-prompts";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

const ARTIFACT_DIR = "/opt/cursor/artifacts/voice-v3-configuration-certification";

function wizardConfig(wizard: ReturnType<typeof createDefaultWizardState>): VoiceAgentConfig {
  return {
    name: wizard.agentName || "Test",
    advanced: {
      capabilityPack: "appointment_receptionist",
      appointmentReceptionistWizard: wizard,
    },
  } as VoiceAgentConfig;
}

function microsoftBookingWizard() {
  const w = createDefaultWizardState();
  w.capabilities = [
    "answer_questions",
    "book_appointments",
    "transfer_calls",
    "reschedule",
    "cancel",
  ];
  w.bookingStrategy = "MICROSOFT_365";
  w.calendarConnected = true;
  w.calendarProvider = "microsoft";
  w.appointmentTypes[0].enabled = true;
  w.appointmentTypes[0].bookingPermission = "book_directly";
  return w;
}

/** Mandatory: Microsoft direct booking ↔ Send booking link strategy switch. */
function certifyBookingStrategySwitch(): void {
  const ms = microsoftBookingWizard();
  const msCompiled = compileVoiceV3AgentConfig({
    wizard: ms,
    providerConnections: { microsoftConnectionId: "conn_1", microsoftCalendarIds: ["primary"] },
  });

  assert.equal(msCompiled.scheduling.bookingStrategy, "MICROSOFT_365");
  assert.ok(isVoiceV3ToolAuthorized(msCompiled, "find_availability"));
  assert.ok(isVoiceV3ToolAuthorized(msCompiled, "book_appointment"));
  assert.equal(isVoiceV3ToolAuthorized(msCompiled, "send_booking_link"), false);
  assert.ok(
    authorizeVoiceV3ToolOrError(msCompiled, "send_booking_link")?.code === "BOOKING_STRATEGY_MISMATCH",
  );

  const link = structuredClone(ms);
  link.bookingStrategy = "SEND_LINK";
  link.bookingLinkUrl = "https://cert-distinct.example/book";
  link.bookingLinkLabel = "Book online";
  const linkCompiled = compileVoiceV3AgentConfig({ wizard: link });

  assert.equal(linkCompiled.scheduling.bookingStrategy, "SEND_LINK");
  assert.equal(linkCompiled.bookingStrategyDetail.bookingLinkUrl, "https://cert-distinct.example/book");
  assert.equal(isVoiceV3ToolAuthorized(linkCompiled, "book_appointment"), false);
  assert.equal(isVoiceV3ToolAuthorized(linkCompiled, "find_availability"), false);
  assert.ok(isVoiceV3ToolAuthorized(linkCompiled, "send_booking_link"));
  assert.ok(listVoiceV3AstraToolNamesForConfig(linkCompiled).includes("send_booking_link"));
  assert.ok(!listVoiceV3AstraToolNamesForConfig(linkCompiled).includes("book_appointment"));

  const prompts = buildVoiceV3Prompts({
    agentConfig: linkCompiled,
    now: new Date(),
    toolNames: listVoiceV3AstraToolNamesForConfig(linkCompiled),
  });
  assert.match(prompts.astraInstructions, /send_booking_link/i);

  const back = structuredClone(link);
  back.bookingStrategy = "MICROSOFT_365";
  const backCompiled = compileVoiceV3AgentConfig({
    wizard: back,
    providerConnections: { microsoftConnectionId: "conn_1", microsoftCalendarIds: ["primary"] },
  });
  assert.ok(isVoiceV3ToolAuthorized(backCompiled, "book_appointment"));
  assert.equal(isVoiceV3ToolAuthorized(backCompiled, "send_booking_link"), false);
}

/** Capability disable must remove tool authorization. */
function certifyCapabilityGating(): void {
  const w = microsoftBookingWizard();
  const on = compileVoiceV3AgentConfig({
    wizard: w,
    providerConnections: { microsoftConnectionId: "c", microsoftCalendarIds: ["primary"] },
  });
  assert.ok(isVoiceV3ToolAuthorized(on, "book_appointment"));

  const off = structuredClone(w);
  off.capabilities = off.capabilities.filter((c) => c !== "book_appointments");
  const offCompiled = compileVoiceV3AgentConfig({
    wizard: off,
    providerConnections: { microsoftConnectionId: "c", microsoftCalendarIds: ["primary"] },
  });
  assert.equal(isVoiceV3ToolAuthorized(offCompiled, "book_appointment"), false);
  assert.equal(isVoiceV3ToolAuthorized(offCompiled, "find_availability"), false);
}

/** Published ACTIVE uses published snapshot; TESTING uses draft (Step 7). */
function certifyPublishResolution(): void {
  const published = createDefaultWizardState();
  published.openingGreeting = "Published greeting";
  const draft = createDefaultWizardState();
  draft.openingGreeting = "Draft greeting";

  const prod = resolveWizardSnapshotForVoiceV3({
    agentStatus: "ACTIVE",
    draftConfig: wizardConfig(draft),
    publishedRuntimeConfig: wizardConfig(published),
  });
  assert.equal(prod.source, "wizard_published");
  assert.equal(prod.wizard?.openingGreeting, "Published greeting");

  const test = resolveWizardSnapshotForVoiceV3({
    agentStatus: "TESTING",
    draftConfig: wizardConfig(draft),
    publishedRuntimeConfig: wizardConfig(published),
  });
  assert.equal(test.source, "wizard_draft_test");
  assert.equal(test.wizard?.openingGreeting, "Draft greeting");
}

/** Cross-step merge must not wipe unrelated fields. */
function certifyCrossStepMerge(): void {
  const server = microsoftBookingWizard();
  server.businessName = "Server Biz";
  const infoPatch = { ...server, businessName: "UI Biz", websiteUrl: "https://ui.example" };
  const merged = mergeWizardStateForSave(server, infoPatch, "information");
  assert.equal(merged.businessName, "UI Biz");
  assert.equal(merged.bookingStrategy, "MICROSOFT_365");

  const chPatch = {
    ...merged,
    warmTransfer: true,
    transferDestinations: [
      { id: "d1", label: "Desk", phoneE164: "+15550009999", enabled: true },
    ],
  };
  const mergedCh = mergeWizardStateForSave(merged, chPatch, "call-handling");
  assert.equal(mergedCh.businessName, "UI Biz");
  assert.equal(mergedCh.warmTransfer, true);
}

/** Spam / solicitor Opus controls compile to runtime spamProtection. */
function certifySpamSolicitorCompilation(): void {
  const w = createDefaultWizardState();
  w.spamLikelyPolicy = "SCREEN";
  w.solicitorPolicy = "DECLINE";
  w.salesSolicitationEnabled = true;
  const cfg = compileVoiceV3AgentConfig({ wizard: w });
  assert.equal(cfg.spamProtection?.spamLikelyPolicy, "SCREEN");
  assert.equal(cfg.spamProtection?.solicitorPolicy, "DECLINE");
  assert.ok(isVoiceV3ToolAuthorized(cfg, "report_unwanted_solicitor"));
}

function run(): void {
  certifyBookingStrategySwitch();
  certifyCapabilityGating();
  certifyPublishResolution();
  certifyCrossStepMerge();
  certifySpamSolicitorCompilation();

  const summary = {
    certifiedAt: new Date().toISOString(),
    layer: "contract_compiler_tool_authorization_publish_resolution",
    cases: [
      "booking_strategy_microsoft_send_link_round_trip",
      "capability_book_appointments_gating",
      "active_vs_testing_wizard_snapshot",
      "cross_step_merge_information_call_handling",
      "spam_solicitor_compile_and_report_unwanted_solicitor_tool",
    ],
    livePstnMatrix: "NOT_RUN — required after contract pass",
    uiReloadPerControl: "NOT_RUN — requires harness or manual matrix",
  };
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  writeFileSync(join(ARTIFACT_DIR, "contract-pass.json"), JSON.stringify(summary, null, 2));
  console.log("VOICE_V3_CONFIGURATION_CERTIFICATION_CONTRACT: PASS");
}

run();
