/**
 * Latency profile A/B/C + Flux opt-in checks.
 * Run: npx tsx scripts/test-voice-latency-profiles.ts
 */
import assert from "node:assert/strict";
import {
  FAST_LLM_MODEL_ID,
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
  rollbackLatencyProfileConfig,
  snapshotProviderLatencyFields,
} from "../src/lib/voice/latency-profiles";
import { buildAssistantTools } from "../src/lib/voice/telnyx/assistant-tools";
import { DEFAULT_VOICE_CONFIG, parseVoiceAgentConfig } from "../src/lib/voice/types";
import { classifyResponseLatencyMs } from "../src/lib/voice/response-latency";

function section(name: string) {
  console.log(`\n== ${name} ==`);
}

section("Defaults stay on legacy cascade (no auto-migrate)");
assert.equal(DEFAULT_VOICE_CONFIG.transcription?.sttModel, "deepgram/nova-3");
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.endpointingMs, 300);
assert.equal(DEFAULT_VOICE_CONFIG.voiceLanguage?.bargeIn, true);

section("Version B Flux profile uses Telnyx-documented defaults");
assert.equal(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.transcription.sttModel, "deepgram/flux");
assert.deepEqual(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.transcription.settings, {
  eot_threshold: 0.8,
  eager_eot_threshold: 0.4,
  eot_timeout_ms: 5000,
});
assert.equal(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.voiceLanguage.endpointingMs, 100);
assert.equal(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.model?.modelId, FAST_LLM_MODEL_ID);
assert.equal(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.voiceLanguage.preferUltra, true);
assert.deepEqual(FLUX_EAGER_LOW_LATENCY_PROFILE.fields.startSpeakingPlan, {
  waitSeconds: 0.1,
  onPunctuationSeconds: 0.1,
  onNoPunctuationSeconds: 1.0,
  onNumberSeconds: 1.0,
});
assert.equal(LEGACY_CASCADE_PROFILE.fields.transcription.sttModel, "deepgram/nova-3");

section("Version C native-audio Ultravox");
assert.equal(NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.nativeAudio, true);
assert.equal(NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.model?.modelId, NATIVE_AUDIO_MODEL_ID);
assert.equal(NATIVE_AUDIO_ULTRAVOX_PROFILE.fields.transcription.enabled, false);
assert.equal(isNativeAudioModel(NATIVE_AUDIO_MODEL_ID), true);
assert.equal(isLatencyOptimizedProfile("flux_eager_low_latency"), true);
assert.equal(isLatencyOptimizedProfile("native_audio_ultravox"), true);
assert.equal(isLatencyOptimizedProfile("legacy_cascade"), false);

section("Apply snapshots rollback; rollback restores");
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
  assert.equal(snap.voiceLanguage.endpointingMs, 300);
  assert.equal(snap.voiceLanguage.silenceTimeoutMs, 800);
  assert.equal(snap.modelId, "moonshotai/Kimi-K2.6");

  const applied = applyLatencyProfileToConfig(base, "flux_eager_low_latency");
  assert.equal(applied.transcription?.sttModel, "deepgram/flux");
  assert.equal(applied.transcription?.settings?.eot_threshold, 0.8);
  assert.equal(applied.transcription?.settings?.eager_eot_threshold, 0.4);
  assert.equal(applied.transcription?.settings?.eot_timeout_ms, 5000);
  assert.equal(applied.voiceLanguage?.endpointingMs, 100);
  assert.equal(applied.voiceLanguage?.bargeIn, true);
  assert.equal(applied.voiceLanguage?.speed, 1.4); // voice speed untouched
  assert.equal(applied.voiceLanguage?.voiceId, "howard-ultra"); // already Ultra
  assert.equal(applied.model?.modelId, FAST_LLM_MODEL_ID);
  assert.equal(applied.voiceTiming?.activeProfile, "flux_eager_low_latency");
  assert.ok(applied.voiceTiming?.rollbackSnapshot);

  const plan = buildStartSpeakingPlanFromConfig(applied);
  assert.equal(plan.wait_seconds, 0.1);
  assert.deepEqual(plan.transcription_endpointing_plan, {
    on_punctuation_seconds: 0.1,
    on_no_punctuation_seconds: 1.0,
    on_number_seconds: 1.0,
  });

  const fluxSettings = buildFluxTranscriptionSettings(applied);
  assert.ok(fluxSettings);
  assert.equal(fluxSettings!.eot_timeout_ms, 5000);

  const rolled = rollbackLatencyProfileConfig(applied);
  assert.equal(rolled.transcription?.sttModel, "deepgram/nova-3");
  assert.equal(rolled.voiceLanguage?.endpointingMs, 300);
  assert.equal(rolled.voiceLanguage?.silenceTimeoutMs, 800);
  assert.equal(rolled.voiceLanguage?.bargeIn, true);
  assert.equal(rolled.model?.modelId, "moonshotai/Kimi-K2.6");
}

section("Version C apply disables STT settings");
{
  const base = parseVoiceAgentConfig({
    transcription: { sttModel: "deepgram/nova-3", enabled: true },
    voiceLanguage: { voiceId: "howard-ultra", endpointingMs: 300, bargeIn: true },
  });
  const c = applyLatencyProfileToConfig(base, "native_audio_ultravox");
  assert.equal(c.model?.modelId, NATIVE_AUDIO_MODEL_ID);
  assert.equal(c.transcription?.enabled, false);
  assert.equal(buildFluxTranscriptionSettings(c), undefined);
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
  const fluxCfg = parseVoiceAgentConfig({
    transcription: {
      sttModel: "deepgram/flux",
      settings: {
        eot_threshold: 0.8,
        eager_eot_threshold: 0.4,
        eot_timeout_ms: 5000,
      },
    },
  });
  const settings = buildFluxTranscriptionSettings(fluxCfg);
  assert.ok(settings);
  assert.equal(settings!.eot_threshold, 0.8);
  assert.equal(settings!.eager_eot_threshold, 0.4);
  assert.equal(settings!.eot_timeout_ms, 5000);

  const novaCfg = parseVoiceAgentConfig({
    transcription: { sttModel: "deepgram/nova-3" },
  });
  assert.equal(buildFluxTranscriptionSettings(novaCfg), undefined);
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
      "book_appointment",
      "create_crm_note",
      "mark_disposition",
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
  assert.equal(byName.get("mark_disposition")?.async, true);
  assert.equal(byName.get("send_sms")?.async, true);
  assert.equal(byName.get("calendar_availability")?.async, undefined);
  const calFillers = byName.get("calendar_availability")?.filler_messages as
    | Array<{ type: string; content: string }>
    | undefined;
  assert.ok(calFillers?.[0]);
  assert.equal(calFillers![0].type, "request_start");
  assert.equal(calFillers![0].content, "Let me check.");
  const lookupFillers = byName.get("lookup_customer")?.filler_messages as
    | Array<{ type: string; content: string }>
    | undefined;
  assert.equal(lookupFillers?.[0]?.content, "One moment while I pull that up.");

  const baseline = buildAssistantTools({
    workspaceId: "ws",
    agentId: "ag",
    bucketIds: [],
    tools: [],
    enabledBuiltinTools: ["calendar_availability", "create_crm_note"],
    optimizeToolLatency: false,
  });
  const baseWebhook = baseline.find(
    (t) =>
      (t as { webhook?: { name?: string } }).webhook?.name === "create_crm_note",
  ) as { webhook?: { async?: boolean } };
  assert.equal(baseWebhook?.webhook?.async, undefined);
}

section("Latency bands: primary goal under 500 ms");
assert.equal(ORDINARY_TURN_LATENCY_BANDS.primaryGoalMs, 500);
assert.equal(classifyResponseLatencyMs(450), "excellent");
assert.equal(classifyResponseLatencyMs(500), "natural");
assert.equal(classifyResponseLatencyMs(650), "usable");
assert.equal(classifyResponseLatencyMs(1100), "investigate");

console.log("\nAll latency profile checks passed.");
