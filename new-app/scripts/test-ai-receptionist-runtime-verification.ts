#!/usr/bin/env npx tsx
/**
 * Full Receptionist runtime verification (handlers + compile + mocks).
 * No PSTN, no real SMS, no real Graph unless INTEGRATION_* env set.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Verdict = "PASS" | "MOCK VERIFIED" | "BLOCKED" | "FAIL";
type Row = { capability: string; verdict: Verdict; evidence: string };

const results: Row[] = [];
function record(capability: string, verdict: Verdict, evidence: string) {
  results.push({ capability, verdict, evidence });
  const tag = verdict === "FAIL" ? "FAIL" : verdict;
  console.log(`[${tag}] ${capability}: ${evidence}`);
}

function fail(capability: string, err: unknown) {
  record(capability, "FAIL", err instanceof Error ? err.message : String(err));
}

async function sectionModeAndPublish() {
  const { defaultReceptionistEditorConfig } = await import(
    "@/lib/server/receptionist/defaults"
  );
  const { enabledVoiceToolNamesFromEditor } = await import(
    "@/lib/server/receptionist/editor-screen-mapping"
  );
  const { compilePublishedBundle } = await import("@/lib/server/receptionist/compile-runtime");
  const { editorToVoiceV3AgentConfig } = await import(
    "@/lib/server/voice-v3/editor-to-voice-v3-config"
  );
  const { isVoiceV3ToolAuthorizedBase } = await import(
    "@/lib/server/voice-v3/tools/authorize-tool-for-config"
  );

  const emptyKnowledge = () => ({
    knowledgeBaseIds: [],
    openaiVectorStoreIds: [],
    documentSourceIds: [],
    faqFacts: [],
    knowledgeItemSummaries: [],
    revision: null,
  });

  const base = defaultReceptionistEditorConfig();
  const ivrTools = enabledVoiceToolNamesFromEditor(base);
  assert.ok(!ivrTools.includes("book_appointment"));
  assert.ok(!ivrTools.includes("update_intake"));

  const full = {
    ...base,
    runtimeProfile: "full_receptionist" as const,
    capabilities: { ...base.capabilities, book: true, qualify: true },
  };
  full.appointments = { ...full.appointments, strategy: "live", provider: "microsoft" };
  const fullTools = enabledVoiceToolNamesFromEditor(full);
  assert.ok(fullTools.includes("book_appointment"));
  assert.ok(fullTools.includes("update_intake"));

  const bundleIvr = compilePublishedBundle({
    editor: base,
    workspaceId: "ws_verify",
    agentId: "ag_verify",
    businessName: "Verify Co",
    timezone: "America/Chicago",
    businessFacts: {},
    knowledge: emptyKnowledge(),
  });
  const bundleFull = compilePublishedBundle({
    editor: full,
    workspaceId: "ws_verify",
    agentId: "ag_verify",
    businessName: "Verify Co",
    timezone: "America/Chicago",
    businessFacts: {},
    knowledge: emptyKnowledge(),
  });
  assert.deepEqual(new Set(bundleIvr.runtime.toolNames), new Set(ivrTools));
  assert.deepEqual(new Set(bundleFull.runtime.toolNames), new Set(fullTools));

  const persisted = JSON.parse(JSON.stringify(full)) as typeof full;
  persisted.runtimeProfile = "conversational_ivr";
  persisted.capabilities.book = true;
  const afterSwitchTools = enabledVoiceToolNamesFromEditor(persisted);
  assert.ok(!afterSwitchTools.includes("book_appointment"), "IVR profile hides book tool even if cap saved");

  const v3Ivr = editorToVoiceV3AgentConfig({
    editor: base,
    workspaceId: "ws_verify",
    agentId: "ag_verify",
    businessName: "Verify Co",
    timezone: "America/Chicago",
    knowledge: emptyKnowledge(),
  });
  assert.equal(isVoiceV3ToolAuthorizedBase(v3Ivr, "book_appointment"), false);
  const v3Full = editorToVoiceV3AgentConfig({
    editor: full,
    workspaceId: "ws_verify",
    agentId: "ag_verify",
    businessName: "Verify Co",
    timezone: "America/Chicago",
    knowledge: emptyKnowledge(),
  });
  assert.equal(isVoiceV3ToolAuthorizedBase(v3Full, "book_appointment"), true);

  record(
    "Mode switching → published tool allowlist",
    "PASS",
    "IVR vs Full compilePublishedBundle toolNames match enabledVoiceToolNamesFromEditor; IVR blocks book when profile switched",
  );
  record(
    "Publish compiler",
    "PASS",
    "compilePublishedBundle + editorToVoiceV3AgentConfig authorize tools per profile",
  );
}

async function sectionIntakeQualification() {
  const { mergeIntakeUpdate } = await import(
    "@/lib/server/voice-v3/intake-objective/merge-intake-update"
  );
  const { editorToVoiceV3AgentConfig } = await import(
    "@/lib/server/voice-v3/editor-to-voice-v3-config"
  );
  const { defaultReceptionistEditorConfig } = await import(
    "@/lib/server/receptionist/defaults"
  );

  const editor = {
    ...defaultReceptionistEditorConfig(),
    runtimeProfile: "full_receptionist" as const,
    capabilities: { ...defaultReceptionistEditorConfig().capabilities, qualify: true },
  };

  const v3 = editorToVoiceV3AgentConfig({
    editor,
    workspaceId: "ws_verify",
    agentId: "ag_verify",
    businessName: "Verify Co",
    timezone: "America/Chicago",
    knowledge: {
      knowledgeBaseIds: [],
      openaiVectorStoreIds: [],
      documentSourceIds: [],
      faqFacts: [],
      knowledgeItemSummaries: [],
      revision: null,
    },
  });

  const merged = mergeIntakeUpdate({
    config: v3,
    current: {},
    update: { i1: "Jane Doe", i2: "+13125550100" },
    at: new Date(),
  });
  assert.ok(merged.updatedFields.includes("i1"));
  const corrected = mergeIntakeUpdate({
    config: v3,
    current: merged.values,
    update: { i1: "Jane Smith" },
    at: new Date(),
  });
  assert.equal(corrected.values.i1?.value, "Jane Smith");

  assert.ok(v3.intakeFields.length > 0, "full receptionist compiles intake fields");
  assert.ok(editor.qualification.rules.length > 0, "qualification rules preserved on editor");

  const { qualificationConfigFromEditor } = await import(
    "@/lib/server/receptionist/qualification-from-editor"
  );
  const qual = qualificationConfigFromEditor(editor);
  assert.equal(qual.enabled, true);
  assert.ok(qual.rules.some((r) => r.fieldKey === "i5" && r.operator === "IN"));

  record("Intake update_intake merge", "PASS", "mergeIntakeUpdate persists and corrects field values (i1/i2)");
  record(
    "Qualification compile",
    "PASS",
    "qualificationConfigFromEditor maps ZIP rule to intake field i5 with IN operator",
  );
}

async function sectionCallbackPersist() {
  if (!process.env.DATABASE_URL?.trim()) {
    record("Callback request_callback persist", "BLOCKED", "DATABASE_URL unset");
    return;
  }
  try {
    const { persistVoiceV3CallbackRequest } = await import(
      "@/lib/server/voice-v3/callback/persist-voice-v3-callback-request"
    );
    const key = `verify_${Date.now()}`;
    const r1 = await persistVoiceV3CallbackRequest({
      workspaceId: "ws_runtime_verify",
      callId: `call_${key}`,
      liveSessionId: "sess",
      agentId: "ag",
      idempotencyKey: key,
      callbackPhoneE164: "+13125550999",
      businessE164: "+13125550001",
      phoneNumberId: null,
      reason: "verify",
      notes: null,
      callerName: "Test",
      inboundAni: "+13125550999",
      preferredTime: null,
      sourceRoute: "voice_v3_request_callback",
    });
    assert.equal(r1.ok, true);
    assert.ok(r1.callbackRequestId);
    const r2 = await persistVoiceV3CallbackRequest({
      workspaceId: "ws_runtime_verify",
      callId: `call_${key}`,
      liveSessionId: "sess",
      agentId: "ag",
      idempotencyKey: key,
      callbackPhoneE164: "+13125550999",
      businessE164: "+13125550001",
      phoneNumberId: null,
      reason: "verify",
      notes: null,
      callerName: "Test",
      inboundAni: "+13125550999",
      preferredTime: null,
      sourceRoute: "voice_v3_request_callback",
    });
    assert.equal(r2.duplicate, true);
    record("Callback request_callback persist", "PASS", `Created callback ${r1.callbackRequestId}, duplicate suppressed`);
  } catch (e) {
    fail("Callback request_callback persist", e);
  }
}

async function sectionBookingLink() {
  const { executeSendBookingLink } = await import(
    "@/lib/server/voice-v3/booking-link/execute-send-booking-link"
  );
  const { editorToVoiceV3AgentConfig } = await import(
    "@/lib/server/voice-v3/editor-to-voice-v3-config"
  );
  const { defaultReceptionistEditorConfig } = await import(
    "@/lib/server/receptionist/defaults"
  );

  const editor = {
    ...defaultReceptionistEditorConfig(),
    runtimeProfile: "full_receptionist" as const,
    capabilities: { ...defaultReceptionistEditorConfig().capabilities, book: true },
  };
  editor.appointments = {
    ...editor.appointments,
    strategy: "link",
    bookingLink: "https://book.example.com/slot",
  };

  const config = editorToVoiceV3AgentConfig({
    editor,
    workspaceId: "ws_verify",
    agentId: "ag_verify",
    businessName: "Verify Co",
    timezone: "America/Chicago",
    knowledge: {
      knowledgeBaseIds: [],
      openaiVectorStoreIds: [],
      documentSourceIds: [],
      faqFacts: [],
      knowledgeItemSummaries: [],
      revision: null,
    },
  });

  const baseCtx = {
    callId: "call_link_verify",
    workspaceId: "ws_verify",
    agentId: "ag_verify",
    telephony: { inboundCallerE164: "+13125550111" },
    runtime: { version: 1 },
    updatedAt: new Date().toISOString(),
  } as import("@/lib/server/voice-v3/state/call-context").VoiceV3CallContext;

  let sendCount = 0;
  const { result, nextContext } = await executeSendBookingLink({
    workspaceId: "ws_verify",
    config,
    context: baseCtx,
    args: { confirmed: true },
    deps: {
      resolveSmsSender: async () => ({ fromE164: "+13125550000", phoneNumberId: "pn_test" }),
      sendSms: async () => {
        sendCount += 1;
        return { providerMessageId: "msg_mock_1", status: "sent" };
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(sendCount, 1);

  const dup = await executeSendBookingLink({
    workspaceId: "ws_verify",
    config,
    context: nextContext,
    args: { confirmed: true },
    deps: {
      resolveSmsSender: async () => ({ fromE164: "+13125550000", phoneNumberId: "pn_test" }),
      sendSms: async () => {
        sendCount += 1;
        return { providerMessageId: "msg_mock_2", status: "sent" };
      },
    },
  });
  assert.equal(dup.result.ok, true);
  assert.equal(sendCount, 1, "duplicate send blocked");

  const failSend = await executeSendBookingLink({
    workspaceId: "ws_verify",
    config,
    context: baseCtx,
    args: { confirmed: true },
    deps: {
      resolveSmsSender: async () => ({ fromE164: "+13125550000", phoneNumberId: "pn_test" }),
      sendSms: async () => {
        throw new Error("provider_down");
      },
    },
  });
  assert.equal(failSend.result.ok, false);

  record(
    "Booking link send_booking_link",
    "MOCK VERIFIED",
    "executeSendBookingLink sent via injected deps, deduped second send, surfaced provider failure",
  );
}

function runMicrosoftSchedulingMockSuite() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const newAppRoot = path.join(scriptDir, "..");
  const preloadServerOnly = path.join(newAppRoot, "../scripts/preload-server-only.mjs");
  const nodeOptions = `--import ${preloadServerOnly}`;
  const r = spawnSync("npx", ["tsx", "scripts/test-ai-receptionist-microsoft-scheduling.ts"], {
    cwd: newAppRoot,
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      AI_RECEPTIONIST_MS_SCHEDULING_MOCK: "1",
    },
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error(
      `Microsoft mock subprocess failed (exit ${r.status}): ${r.stderr || r.stdout || "no output"}`,
    );
  }
  record("Microsoft availability (Graph busy mock)", "MOCK VERIFIED", "findAvailability respects busy blocks");
  record("Microsoft booking (Graph create mock)", "MOCK VERIFIED", "bookAppointment calls microsoftCreateEvent");
  record("Microsoft rescheduling (Graph patch mock)", "MOCK VERIFIED", "rescheduleAppointment patches event");
  record("Microsoft cancellation (Graph delete mock)", "MOCK VERIFIED", "cancelAppointment deletes event");
  record(
    "Microsoft OAuth / token refresh",
    "BLOCKED",
    "Requires live voiceCalendarConnection row — not exercised in mock suite",
  );
  record(
    "Microsoft live Graph integration",
    "BLOCKED",
    "No authorized test calendar in this environment — mock subprocess only",
  );
}

async function sectionSpamTool() {
  const { isVoiceV3ToolAuthorizedBase } = await import(
    "@/lib/server/voice-v3/tools/authorize-tool-for-config"
  );
  const { editorToVoiceV3AgentConfig } = await import(
    "@/lib/server/voice-v3/editor-to-voice-v3-config"
  );
  const { defaultReceptionistEditorConfig } = await import(
    "@/lib/server/receptionist/defaults"
  );

  const editor = {
    ...defaultReceptionistEditorConfig(),
    runtimeProfile: "full_receptionist" as const,
    protection: defaultReceptionistEditorConfig().protection.map((r) =>
      r.kind === "solicitor" ? { ...r, enabled: true, action: "end" as const } : r,
    ),
  };
  const v3 = editorToVoiceV3AgentConfig({
    editor,
    workspaceId: "ws_verify",
    agentId: "ag_verify",
    businessName: "Verify Co",
    timezone: "America/Chicago",
    knowledge: {
      knowledgeBaseIds: [],
      openaiVectorStoreIds: [],
      documentSourceIds: [],
      faqFacts: [],
      knowledgeItemSummaries: [],
      revision: null,
    },
  });
  assert.equal(v3.spamProtection?.solicitorPolicy, "DECLINE");
  assert.equal(isVoiceV3ToolAuthorizedBase(v3, "report_unwanted_solicitor"), true);
  record(
    "Spam screening tool exposure",
    "PASS",
    "solicitor action end → DECLINE policy exposes report_unwanted_solicitor",
  );
}

async function main() {
  console.log("=== AI Receptionist runtime verification ===\n");
  try {
    await sectionModeAndPublish();
  } catch (e) {
    fail("Mode switching → published tool allowlist", e);
  }
  try {
    await sectionIntakeQualification();
  } catch (e) {
    fail("Intake / qualification", e);
  }
  await sectionCallbackPersist();
  try {
    await sectionBookingLink();
  } catch (e) {
    fail("Booking link send_booking_link", e);
  }
  try {
    runMicrosoftSchedulingMockSuite();
  } catch (e) {
    fail("Microsoft scheduling suite", e);
  }
  try {
    await sectionSpamTool();
  } catch (e) {
    fail("Spam screening", e);
  }

  const fails = results.filter((r) => r.verdict === "FAIL");
  console.log("\n=== Summary ===");
  for (const r of results) {
    console.log(`${r.verdict.padEnd(14)} | ${r.capability}`);
  }
  if (fails.length) {
    process.exit(1);
  }
  console.log("\nAll non-FAIL checks completed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
