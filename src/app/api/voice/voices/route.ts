import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  CURATED_TELNYX_VOICES,
  CURATED_VOICE_CATALOG,
  DEFAULT_CATALOG_VOICE_ID,
} from "@/lib/voice/telnyx/voices";
import { getElevenLabsSecretStatus } from "@/lib/voice/elevenlabs/telnyx-secret";
import { discoverElevenLabsCatalog } from "@/lib/voice/elevenlabs/probe";
import { ELEVENLABS_CANDIDATE_MODELS } from "@/lib/voice/elevenlabs/models";

/**
 * Curated Telnyx voices + discovered ElevenLabs voices (when connected).
 * Does not expose API keys.
 */
export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const secret = await getElevenLabsSecretStatus();
    let elevenLabsVoices = CURATED_TELNYX_VOICES.filter(() => false);
    let elevenLabsMeta: Record<string, unknown> = {
      connected: secret.connected,
      configuredEnv: secret.configuredEnv,
      secretIdentifier: secret.secretIdentifier,
      message: secret.message,
      candidateModels: ELEVENLABS_CANDIDATE_MODELS,
    };

    if (secret.configuredEnv) {
      try {
        const discovery = await discoverElevenLabsCatalog({ voiceLimit: 10 });
        elevenLabsVoices = discovery.pickerVoices;
        elevenLabsMeta = {
          ...elevenLabsMeta,
          connected: discovery.secret.connected,
          modelsOnAccount: discovery.candidateModels,
          voiceCount: discovery.voices.length,
        };
      } catch (err) {
        elevenLabsMeta = {
          ...elevenLabsMeta,
          discoveryError: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return NextResponse.json({
      data: {
        voices: [...CURATED_TELNYX_VOICES, ...elevenLabsVoices],
        catalog: CURATED_VOICE_CATALOG.filter((v) => v.enabled).map((v) => ({
          catalogId: v.catalogId,
          displayName: v.displayName,
          style: v.style,
          model: v.model,
          locale: v.locale,
          gender: v.gender,
          qualityTier: v.qualityTier,
          uiTier: v.uiTier,
          uiTierLabel:
            v.uiTier === "ultra" ? "Ultra — Fast, natural, included" : "Standard Voice",
          providerVoiceId: v.providerVoiceId,
          supportsSpeed: v.supportsSpeed,
          supportsExpressive: v.supportsExpressive,
          previewOnly: Boolean(v.previewOnly),
          assistantCompatible: v.assistantCompatible !== false && !v.previewOnly,
        })),
        elevenLabs: elevenLabsMeta,
        defaultCatalogId: DEFAULT_CATALOG_VOICE_ID,
        source: "curated+elevenlabs",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
