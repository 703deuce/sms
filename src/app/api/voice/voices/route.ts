import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import {
  CURATED_TELNYX_VOICES,
  type TelnyxVoiceOption,
} from "@/lib/voice/telnyx/voices";

/**
 * List Telnyx TTS voices for the agent builder picker.
 * Merges curated Ultra/NaturalHD favorites with live catalog when available.
 */
export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const curated = CURATED_TELNYX_VOICES;
    if (!getTelnyxApiKey()) {
      return NextResponse.json({ data: { voices: curated, source: "curated" } });
    }

    try {
      const res = await telnyxRequest<{
        data?: Array<Record<string, unknown>>;
        voices?: Array<Record<string, unknown>>;
      }>("/text-to-speech/voices", {
        query: { provider: "telnyx" },
      });
      const raw = (res.data || res.voices || []) as Array<Record<string, unknown>>;
      const remote: TelnyxVoiceOption[] = raw
        .map((v) => {
          const id = String(v.voice_id || v.id || v.name || "");
          if (!id || (!id.includes("Ultra") && !id.includes("NaturalHD") && !id.includes("Natural."))) {
            return null;
          }
          const name = String(v.name || id.split(".").pop() || id);
          const genderRaw = String(v.gender || v.sex || "neutral").toLowerCase();
          const gender =
            genderRaw.startsWith("f") ? "female" : genderRaw.startsWith("m") ? "male" : "neutral";
          const tier = id.includes("Ultra")
            ? "ultra"
            : id.includes("NaturalHD")
              ? "natural_hd"
              : "natural";
          return {
            id,
            name,
            gender: gender as TelnyxVoiceOption["gender"],
            tier: tier as TelnyxVoiceOption["tier"],
            language: String(v.language || v.locale || "en"),
            description: String(v.description || tier),
          } satisfies TelnyxVoiceOption;
        })
        .filter(Boolean) as TelnyxVoiceOption[];

      const byId = new Map<string, TelnyxVoiceOption>();
      for (const v of curated) byId.set(v.id, v);
      for (const v of remote) {
        if (!byId.has(v.id)) byId.set(v.id, v);
      }
      // Ultra first, then NaturalHD
      const voices = [...byId.values()].sort((a, b) => {
        const rank = (t: string) => (t === "ultra" ? 0 : t === "natural_hd" ? 1 : 2);
        return rank(a.tier) - rank(b.tier) || a.name.localeCompare(b.name);
      });
      return NextResponse.json({
        data: { voices, source: remote.length ? "telnyx+curated" : "curated" },
      });
    } catch {
      return NextResponse.json({ data: { voices: curated, source: "curated" } });
    }
  } catch (err) {
    return jsonError(err, 500);
  }
}
