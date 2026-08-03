import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  CURATED_TELNYX_VOICES,
  CURATED_VOICE_CATALOG,
  DEFAULT_CATALOG_VOICE_ID,
} from "@/lib/voice/telnyx/voices";

/**
 * Curated voice catalog for the agent builder.
 * Does not expose hundreds of unorganized provider IDs.
 */
export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    return NextResponse.json({
      data: {
        voices: CURATED_TELNYX_VOICES,
        catalog: CURATED_VOICE_CATALOG.filter((v) => v.enabled).map((v) => ({
          catalogId: v.catalogId,
          displayName: v.displayName,
          style: v.style,
          model: v.model,
          locale: v.locale,
          gender: v.gender,
          qualityTier: v.qualityTier,
          uiTier: v.uiTier,
          uiTierLabel: v.uiTier === "ultra" ? "Ultra Voice" : "Standard Voice",
          providerVoiceId: v.providerVoiceId,
          supportsSpeed: v.supportsSpeed,
          supportsExpressive: v.supportsExpressive,
          previewOnly: Boolean(v.previewOnly),
          assistantCompatible: v.assistantCompatible !== false && !v.previewOnly,
        })),
        defaultCatalogId: DEFAULT_CATALOG_VOICE_ID,
        source: "curated",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
