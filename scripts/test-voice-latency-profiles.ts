/**
 * Latency profile A/B/C corrections + Flux payload mapping checks.
 * Run: npx tsx scripts/test-voice-latency-profiles.ts
 */
import assert from "node:assert/strict";
import {
  FAST_LLM_MODEL_ID,
  FLUX_B_BALANCED_PROFILE,
  FLUX_B_FAST_PROFILE,
  FLUX_B_PATIENT_PROFILE,
  FLUX_EAGER_LOW_LATENCY_PROFILE,
  LEGACY_CASCADE_PROFILE,
  NATIVE_AUDIO_MODEL_ID,
  NATIVE_AUDIO_ULTRAVOX_PROFILE,
  ORDINARY_TURN_LATENCY_BANDS,
  applyLatencyProfileToConfig,
  buildFluxTranscriptionSettings,
  buildStartSpeakingPlanFromConfig,
  isDeepgramFluxModel,
  isLatencyOptimizedProfile,
  isNativeAudioModel,
  resolveLatencyProfileAlias,
  rollbackLatencyProfileConfig,
  shouldSkipDynamicVariablesWebhook,
  snapshotProviderLatencyFields,
} from "../src/lib/voice/latency-profiles";
import { buildAssistantTools } from "../src/lib/voice/telnyx/assistant-tools";
import { DEFAULT_VOICE_CONFIG, parseVoiceAgentConfig } from "../src/lib/voice/types";
import { classifyResponseLatencyMs } from "../src/lib/voice/response-latency";

function section(name: string) {
  console.log(`\n== ${name} ==`);
}

section("Product default: Flux B balanced + TeXML-ready defaults");
assert.equal(DEFAULT_VOICE_CONFIG.transcription?.sttModel, "deepgram/flux");
assert.equal(DEFAULT_VOICE_CONFIG.voiceTiming?.activeProfile, "flux_b_balanced");
assert.equal(DEFAULT_VOICE_CONFIG.model?.modelId, FAST_LLM_MODEL_ID);
assert.equal(
  (DEFAULT_VOICE_CONFIG.callHandling as { inboundRoutingMode?: string })
    ?.inboundRoutingMode,
  "texml_direct",
);
assert.equal(
  (DEFAULT_VOICE_CONFIG.callHandling as { startupGreeting?: { enabled?: boolean } })
    ?.startupGreeting?.enabled,
  false,
);
// Existing stored configs without voiceTiming must not be silently migrated.
{
  const legacyStored = parseVoiceAgentConfig({
    transcription: { sttModel: "deepgram/nova-3" },
    voiceLanguage: { voiceId: "ava-warm-us", endpointingMs: 300, bargeIn: true },
    model: { modelId: "moonshotai/Kimi-K2.6" },
  });
  assert.equal(legacyStored.voiceTiming, undefined);
  assert.equal(legacyStored.transcription?.sttModel, "deepgram/nova-3");
  assert.equal(legacyStored.transcription?.settings, undefined);
  assert.equal(
    (legacyStored.callHandling as { inboundRoutingMode?: string } | undefined)
      ?.inboundRoutingMode,
    undefined,
  );
}

section("Version B Flux: EOT only + wait_seconds — NO 1s no-punct plan");
assert.equal(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.transcription.sttModel, "deepgram/flux");
assert.deepEqual(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.transcription.settings, {
  eot_threshold: 0.8,
  eager_eot_threshold: 0.4,
  eot_timeout_ms: 5000,
});
assert.equal(
  FLUX_EAGER_LOW_LATENCY_PROFILE.fields.startSpeakingPlan?.fluxOmitTranscriptionEndpointingPlan,
  true,
);
assert.equal(
  FLUX_EAGER_LOW_LATENCY_PROFILE.fields.startSpeakingPlan?.onNoPunctuationSeconds,
  undefined,
);
assert.equal(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.skipDynamicVariablesWebhook, false);
assert.equal(
  FLUX_EAGER_LOW_LATENCY_PROFILE.fields.telnyxFieldPlan?.on_no_punctuation_seconds,
  "not_sent",
);
assert.equal(
  FLUX_EAGER_LOW_LATENCY_PROFILE.fields.voiceLanguage.endpointingMs,
  undefined,
);

section("B_FAST / B_BALANCED / B_PATIENT EOT pairs");
{
  assert.deepEqual(FLUX_B_FAST_PROFILE.fields.transcription.settings, {
    eot_threshold: 0.75,
    eager_eot_threshold: 0.35,
    eot_timeout_ms: 5000,
  });
  assert.deepEqual(FLUX_B_BALANCED_PROFILE.fields.transcription.settings, {
    eot_threshold: 0.8,
    eager_eot_threshold: 0.4,
    eot_timeout_ms: 5000,
  });
  assert.deepEqual(FLUX_B_PATIENT_PROFILE.fields.transcription.settings, {
    eot_threshold: 0.85,
    eager_eot_threshold: 0.45,
    eot_timeout_ms: 5000,
  });
  assert.equal(resolveLatencyProfileAlias("B_FAST"), "flux_b_fast");
  assert.equal(resolveLatencyProfileAlias("B"), "flux_b_balanced");
  assert.equal(isLatencyOptimizedProfile("flux_b_fast"), true);

  const fast = applyLatencyProfileToConfig(
    parseVoiceAgentConfig({
      transcription: { sttModel: "deepgram/nova-3" },
      voiceLanguage: { voiceId: "howard-ultra", endpointingMs: 300, bargeIn: true },
    }),
    "flux_b_fast",
  );
  assert.equal(fast.transcription?.settings?.eot_threshold, 0.75);
  assert.equal(fast.transcription?.settings?.eager_eot_threshold, 0.35);
  assert.equal(fast.voiceLanguage?.endpointingMs, undefined);
  assert.equal(fast.model?.modelId, FAST_LLM_MODEL_ID);
}

section("Version C Ultravox: no copied endpointing plan; TTS voice expected");
assert.equal(NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.nativeAudio, true);
assert.equal(NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.model?.modelId, NATIVE_AUDIO_MODEL_ID);
assert.match(NATIVE_AUDIO_MODEL_ID, /ultravox-v0_4_1-llama-3_1-8b/);
assert.equal(NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.startSpeakingPlan, null);
assert.equal(NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.transcription.enabled, false);
assert.equal(NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.voiceLanguage.preferUltra, true);
assert.equal(
  NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.telnyxFieldPlan?.transcription,
  "ignored_by_native_audio_model",
);
assert.equal(
  NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.telnyxFieldPlan?.ultravox_outgoing_audio_path,
  "unknown_requires_call_trace",
);
assert.equal(isNativeAudioModel(NATIVE_AUDIO_MODEL_ID), true);
assert.equal(LEGACY_CASCADE_PROFILE.fields.transcription.sttModel, "deepgram/nova-3");

section("Apply B: Flux settings + wait-only plan");
{
  const base = parseVoiceAgentConfig({
    transcription: {
      enabled: true,
      sttProvider: "deepgram",
      sttModel: "deepgram/nova-3",
      language: "en",
    },
    voiceLanguage: {
      voiceId: "howard-ultra",
      endpointingMs: 300,
      silenceTimeoutMs: 800,
      bargeIn: true,
      speed: 1.4,
    },
    model: { modelId: "moonshotai/Kimi-K2.6" },
    callHandling: { greeting: "Thanks for calling Acme. How can I help?" },
  });
  const snap = snapshotProviderLatencyFields(base);
  assert.equal(snap.transcription.sttModel, "deepgram/nova-3");

  const applied = applyLatencyProfileToConfig(base, "flux_eager_low_latency");
  assert.equal(applied.transcription?.sttModel, "deepgram/flux");
  assert.equal(applied.transcription?.settings?.eot_timeout_ms, 5000);
  assert.equal(applied.voiceLanguage?.endpointingMs, undefined);
  assert.equal(applied.model?.modelId, FAST_LLM_MODEL_ID);
  assert.equal(shouldSkipDynamicVariablesWebhook(applied), false);

  const plan = buildStartSpeakingPlanFromConfig(applied);
  assert.ok(plan);
  assert.equal(plan!.wait_seconds, 0.1);
  assert.equal(plan!.transcription_endpointing_plan, null);

  const fluxSettings = buildFluxTranscriptionSettings(applied);
  assert.ok(fluxSettings);
  assert.equal(fluxSettings!.eager_eot_threshold, 0.4);

  const rolled = rollbackLatencyProfileConfig(applied);
  assert.equal(rolled.transcription?.sttModel, "deepgram/nova-3");
  assert.equal(rolled.model?.modelId, "moonshotai/Kimi-K2.6");
}

section("Apply C: omit start_speaking_plan; Ultra preferred for TTS");
{
  const base = parseVoiceAgentConfig({
    transcription: { sttModel: "deepgram/nova-3", enabled: true },
    voiceLanguage: {
      voiceId: "howard-ultra",
      endpointingMs: 300,
      bargeIn: true,
    },
  });
  const c = applyLatencyProfileToConfig(base, "native_audio_ultravox");
  assert.equal(c.model?.modelId, NATIVE_AUDIO_MODEL_ID);
  assert.equal(c.transcription?.enabled, false);
  assert.equal(c.voiceLanguage?.voiceId, "howard-ultra");
  assert.equal(buildFluxTranscriptionSettings(c), undefined);
  const cPlan = buildStartSpeakingPlanFromConfig(c);
  assert.ok(cPlan);
  assert.equal(cPlan!.transcription_endpointing_plan, null);
  assert.equal(shouldSkipDynamicVariablesWebhook(c), true);
}

section("Legacy cascade still sends punctuation plan");
{
  const legacy = parseVoiceAgentConfig({
    transcription: { sttModel: "deepgram/nova-3" },
    voiceLanguage: { endpointingMs: 300, bargeIn: true },
    voiceTiming: { activeProfile: "legacy_cascade" },
  });
  const plan = buildStartSpeakingPlanFromConfig(legacy);
  assert.ok(plan?.transcription_endpointing_plan);
}

section("Prefer Ultra when switching from NaturalHD");
{
  const base = parseVoiceAgentConfig({
    voiceLanguage: { voiceId: "Telnyx.NaturalHD.Astra", endpointingMs: 300 },
  });
  const applied = applyLatencyProfileToConfig(base, "flux_eager_low_latency");
  assert.equal(applied.voiceLanguage?.voiceId, "allie-ultra");
}

section("Flux settings only for flux model");
{
  assert.equal(isDeepgramFluxModel("deepgram/flux"), true);
  assert.equal(isDeepgramFluxModel("deepgram/nova-3"), false);
  assert.equal(isLatencyOptimizedProfile("flux_eager_low_latency"), true);
  assert.equal(isLatencyOptimizedProfile("legacy_cascade"), false);
}

section("Async tools + sync fillers when optimizeToolLatency");
{
  const optimized = buildAssistantTools({
    workspaceId: "ws",
    agentId: "ag",
    bucketIds: [],
    tools: [],
    enabledBuiltinTools: [
      "hangup",
      "calendar_availability",
      "create_crm_note",
      "send_sms",
      "lookup_customer",
    ],
    optimizeToolLatency: true,
  });
  const byName = new Map(
    optimized
      .filter((t) => (t as { type?: string }).type === "webhook")
      .map((t) => {
        const w = (t as { webhook: Record<string, unknown> }).webhook;
        return [String(w.name), w] as const;
      }),
  );
  assert.equal(byName.get("create_crm_note")?.async, true);
  assert.equal(byName.get("send_sms")?.async, true);
  const calFillers = byName.get("calendar_availability")?.filler_messages as
    | Array<{ type: string; content: string }>
    | undefined;
  assert.equal(calFillers?.[0]?.content, "Let me check.");
}

section("Apply Flux profile sets TeXML direct + disables startup mask");
{
  const applied = applyLatencyProfileToConfig(
    parseVoiceAgentConfig({
      transcription: { sttModel: "deepgram/nova-3" },
      voiceLanguage: { voiceId: "howard-ultra", endpointingMs: 300 },
      callHandling: {
        startupGreeting: { enabled: true, mode: "audio_url" },
      },
    }),
    "flux_b_balanced",
  );
  assert.equal(
    (applied.callHandling as { inboundRoutingMode?: string }).inboundRoutingMode,
    "texml_direct",
  );
  assert.equal(
    (applied.callHandling as { startupGreeting?: { enabled?: boolean } })
      .startupGreeting?.enabled,
    false,
  );
  const legacy = applyLatencyProfileToConfig(applied, "legacy_cascade");
  assert.equal(
    (legacy.callHandling as { inboundRoutingMode?: string }).inboundRoutingMode,
    "call_control",
  );
}

section("Latency bands: primary goal under 500 ms");
assert.equal(ORDINARY_TURN_LATENCY_BANDS.primaryGoalMs, 500);
assert.equal(classifyResponseLatencyMs(450), "excellent");
assert.equal(classifyResponseLatencyMs(500), "natural");
assert.equal(classifyResponseLatencyMs(650), "usable");
assert.equal(classifyResponseLatencyMs(1100), "investigate");

console.log("\nAll latency profile checks passed.");
