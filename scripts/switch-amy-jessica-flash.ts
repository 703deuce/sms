/**
 * Switch Amy (866) to ElevenLabs Flash + Jessica on the Telnyx AI Assistant.
 * Probes on a disposable clone before publish — production unchanged if Telnyx rejects.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/switch-amy-jessica-flash.ts
 */
import { getPrisma } from "../src/lib/db";
import { listElevenLabsVoices, listElevenLabsModels } from "../src/lib/voice/elevenlabs/client";
import {
  ELEVENLABS_CANDIDATE_MODELS,
  catalogIdForElevenLabs,
} from "../src/lib/voice/elevenlabs/models";
import { ensureElevenLabsTelnyxSecret } from "../src/lib/voice/elevenlabs/telnyx-secret";
import { updateVoiceAgentDraft, publishVoiceAgent } from "../src/lib/voice/agent-service";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { testVoiceOnClone } from "../src/lib/voice/telnyx/voice-probe";
import * as ai from "../src/lib/voice/telnyx/ai-client";

const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
const AMY_AGENT_ID = process.env.AMY_AGENT_ID || "cmshz2lc25c622c4i58303501";
const PHONE_E164 = process.env.PHONE_E164 || "+18663464256";

const PHONE_866_ID = process.env.PHONE_866_ID || "cmsc3numa1j17084g391t2z5l";

const JESSICA_NAME_HINT =
  process.env.JESSICA_VOICE_NAME || "Jessica - Playful, Bright, Warm";

async function resolveJessicaVoiceId(): Promise<string> {
  const voices = await listElevenLabsVoices();
  const exact = voices.find((v) => v.name === JESSICA_NAME_HINT);
  if (exact?.voice_id) return exact.voice_id;
  const fuzzy = voices.find((v) => /^jessica\b/i.test(v.name));
  if (fuzzy?.voice_id) return fuzzy.voice_id;
  throw new Error(
    `Jessica voice not found on ElevenLabs account (hint: ${JESSICA_NAME_HINT})`,
  );
}

function resolveFlashModelId(): string {
  const fromEnv = process.env.ELEVENLABS_FLASH_MODEL_ID?.trim();
  if (fromEnv) return fromEnv;
  const flash = ELEVENLABS_CANDIDATE_MODELS.find((m) =>
    m.uiTier === "elevenlabs_flash",
  );
  if (flash?.modelId && flash.modelId !== "[REDACTED]") {
    return flash.modelId;
  }
  return "";
}

async function resolveFlashModelIdFromApi(): Promise<string> {
  const cached = resolveFlashModelId();
  if (cached) return cached;
  const models = await listElevenLabsModels();
  const flash = models.find(
    (m) =>
      m.can_do_text_to_speech &&
      (/flash.*v2\.5/i.test(m.name) || /flash.*2\.5/i.test(m.model_id)),
  );
  if (flash?.model_id) return flash.model_id;
  const anyFlash = models.find(
    (m) => m.can_do_text_to_speech && /flash/i.test(m.model_id),
  );
  if (anyFlash?.model_id) return anyFlash.model_id;
  throw new Error("ElevenLabs Flash model not found on account");
}

async function main() {
  // Amy 866 must stay on TeXML → Telnyx assistant. Default env is LiveKit, which
  // repoints the DID to broken SIP and yields "not in service" on PSTN.
  process.env.VOICE_RUNTIME_PROVIDER = "telnyx";

  const prisma = getPrisma();
  const agent = await prisma.voiceAgent.findFirst({
    where: { id: AMY_AGENT_ID, workspaceId: WORKSPACE_ID },
  });
  if (!agent) throw new Error(`Amy agent ${AMY_AGENT_ID} not found`);
  if (!agent.telnyxAssistantId) {
    throw new Error("Amy has no telnyxAssistantId — publish Telnyx assistant first");
  }

  const secret = await ensureElevenLabsTelnyxSecret();
  console.log("ElevenLabs Telnyx secret:", secret.message);

  const jessicaVoiceId = await resolveJessicaVoiceId();
  const flashModelId = await resolveFlashModelIdFromApi();
  const voiceRef = catalogIdForElevenLabs(flashModelId, jessicaVoiceId);

  console.log("\n=== Target voice ===");
  console.log(
    JSON.stringify(
      {
        agent: agent.name,
        phone: PHONE_E164,
        telnyxAssistantId: agent.telnyxAssistantId,
        voiceRef,
        jessicaVoiceId,
        flashModelId,
        apiKeyRef: secret.apiKeyRef,
      },
      null,
      2,
    ),
  );

  const prev = parseVoiceAgentConfig(agent.draftConfig);
  const prevVoice = prev.voiceLanguage?.voiceId;

  console.log("\n=== Preflight clone probe ===");
  const probe = await testVoiceOnClone({
    sourceAssistantId: agent.telnyxAssistantId,
    voiceRef,
    includeElevenLabsTuning: true,
    apiKeyRef: secret.apiKeyRef,
  });
  if (!probe.ok) {
    console.error(JSON.stringify(probe, null, 2));
    throw new Error(
      probe.error?.message || "Telnyx rejected ElevenLabs Flash + Jessica on clone",
    );
  }
  console.log(
    JSON.stringify(
      {
        ok: probe.ok,
        remoteVoice: probe.remoteVoice,
        readBackMatch: probe.readBackMatch,
        testAssistantId: probe.testAssistantId,
      },
      null,
      2,
    ),
  );

  console.log("\n=== Save draft voice ===");
  const voiceLanguage = {
    ...(prev.voiceLanguage || {}),
    voiceId: voiceRef,
    voiceProvider: "elevenlabs",
    expressiveMode: false,
    elevenLabsApiKeyRef: secret.apiKeyRef,
    elevenLabsTuning: true,
    elevenLabsStability: 0.45,
    elevenLabsSimilarityBoost: 0.75,
    speed: prev.voiceLanguage?.speed ?? 1,
  };
  await updateVoiceAgentDraft(WORKSPACE_ID, AMY_AGENT_ID, {
    draftConfig: { ...prev, voiceLanguage },
  });
  console.log(`draft voice: ${prevVoice} → ${voiceRef}`);

  console.log("\n=== Publish (Telnyx assistant sync) ===");
  const published = await publishVoiceAgent(
    WORKSPACE_ID,
    AMY_AGENT_ID,
    "switch-jessica-flash",
  );
  console.log(
    JSON.stringify(
      {
        agent: published.agent.name,
        status: published.agent.status,
        version: published.version.version,
        telnyxAssistantId: published.agent.telnyxAssistantId,
        texmlRoute: published.texmlRoute,
      },
      null,
      2,
    ),
  );

  console.log("\n=== Ensure TeXML inbound (never LiveKit on 866) ===");
  const { restoreTexmlInboundRoute } = await import(
    "../src/lib/telephony/provisioning/number-assignment"
  );
  const restored = await restoreTexmlInboundRoute({
    workspaceId: WORKSPACE_ID,
    phoneNumberId: PHONE_866_ID,
    agentId: AMY_AGENT_ID,
  });
  if (!restored.ok) {
    throw new Error(`TeXML route restore failed for ${PHONE_E164}`);
  }
  console.log(JSON.stringify(restored, null, 2));

  const remote = await ai.getAssistant(published.agent.telnyxAssistantId!);
  const remoteObj = (remote as { data?: Record<string, unknown> } | Record<string, unknown>)
    ?.data
    ? ((remote as { data: Record<string, unknown> }).data as Record<string, unknown>)
    : (remote as Record<string, unknown>);
  const vs = (remoteObj?.voice_settings || {}) as Record<string, unknown>;
  const remoteVoice = String(vs.voice || "");
  const isElevenLabsLive =
    remoteVoice.startsWith("ElevenLabs.") && Boolean(vs.api_key_ref);
  console.log("\n=== Live Telnyx voice_settings ===");
  console.log(
    JSON.stringify(
      {
        voice: vs.voice,
        api_key_ref: vs.api_key_ref,
        temperature: vs.temperature,
        similarity_boost: vs.similarity_boost,
        expressive_mode: vs.expressive_mode,
      },
      null,
      2,
    ),
  );

  if (!isElevenLabsLive) {
    console.log("\n=== Voice not on assistant yet — forcing Telnyx resync ===");
    const { syncTelnyxAssistant } = await import("../src/lib/voice/telnyx/assistant-sync");
    const ver = await getPrisma().voiceAgentVersion.findFirst({
      where: { agentId: AMY_AGENT_ID },
      orderBy: { version: "desc" },
    });
    const config = parseVoiceAgentConfig(ver?.config);
    await syncTelnyxAssistant(WORKSPACE_ID, published.agent as never, config);
    const remote2 = await ai.getAssistant(published.agent.telnyxAssistantId!);
    const remoteObj2 = (remote2 as { data?: Record<string, unknown> } | Record<string, unknown>)
      ?.data
      ? ((remote2 as { data: Record<string, unknown> }).data as Record<string, unknown>)
      : (remote2 as Record<string, unknown>);
    const vs2 = (remoteObj2?.voice_settings || {}) as Record<string, unknown>;
    console.log(
      JSON.stringify(
        {
          voice: vs2.voice,
          api_key_ref: vs2.api_key_ref,
          expressive_mode: vs2.expressive_mode,
        },
        null,
        2,
      ),
    );
    if (!String(vs2.voice || "").startsWith("ElevenLabs.")) {
      throw new Error("Telnyx assistant still not on ElevenLabs after resync");
    }
  }

  console.log(`\nDone. Call ${PHONE_E164} to hear Jessica (ElevenLabs Flash).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
