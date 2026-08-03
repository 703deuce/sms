/**
 * Live Telnyx TTS catalog helpers for AI Assistants voice selection.
 * Prefer querying GET /v2/text-to-speech/voices at runtime — catalog drifts.
 */

import * as ai from "@/lib/voice/telnyx/ai-client";

const ULTRA_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TelnyxCatalogVoice = {
  provider?: string;
  name?: string;
  voice_id?: string;
  language?: string;
  gender?: string;
  /** Normalized Assistants voice string when parseable */
  providerVoiceId?: string;
  model?: "NaturalHD" | "Ultra" | string;
  assistantCompatible?: boolean;
  excludeReason?: string;
};

function asVoiceRows(raw: unknown): TelnyxCatalogVoice[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const list = Array.isArray(obj.voices)
    ? obj.voices
    : Array.isArray((obj.data as { voices?: unknown })?.voices)
      ? ((obj.data as { voices: unknown[] }).voices as unknown[])
      : Array.isArray(obj.data)
        ? (obj.data as unknown[])
        : [];
  return list
    .map((row) => {
      const r = (row || {}) as Record<string, unknown>;
      return {
        provider: r.provider != null ? String(r.provider) : undefined,
        name: r.name != null ? String(r.name) : undefined,
        voice_id: r.voice_id != null ? String(r.voice_id) : undefined,
        language: r.language != null ? String(r.language) : undefined,
        gender: r.gender != null ? String(r.gender) : undefined,
      };
    })
    .filter((v) => v.voice_id);
}

/**
 * Normalize API voice_id values into Assistants `voice_settings.voice` strings.
 * API may return either a bare id or an already-qualified Telnyx.* string.
 */
export function normalizeTelnyxProviderVoiceId(voiceId: string): string | null {
  const raw = String(voiceId || "").trim();
  if (!raw) return null;
  if (raw.startsWith("Telnyx.NaturalHD.") || raw.startsWith("Telnyx.Ultra.")) {
    return raw;
  }
  if (ULTRA_UUID_RE.test(raw)) {
    return `Telnyx.Ultra.${raw}`;
  }
  // NaturalHD voice ids are typically lowercase names (astra, luna, …)
  if (/^[a-z][a-z0-9_]*$/i.test(raw) && !raw.includes(".")) {
    return `Telnyx.NaturalHD.${raw}`;
  }
  return null;
}

export function classifyAssistantVoice(providerVoiceId: string): {
  model: "NaturalHD" | "Ultra" | null;
  assistantCompatible: boolean;
  excludeReason?: string;
} {
  if (providerVoiceId.startsWith("Telnyx.NaturalHD.")) {
    return { model: "NaturalHD", assistantCompatible: true };
  }
  if (providerVoiceId.startsWith("Telnyx.Ultra.")) {
    const id = providerVoiceId.slice("Telnyx.Ultra.".length);
    if (ULTRA_UUID_RE.test(id)) {
      return { model: "Ultra", assistantCompatible: true };
    }
    return {
      model: "Ultra",
      assistantCompatible: false,
      excludeReason:
        "Assistants reject Ultra short names (use Telnyx.Ultra.<uuid>)",
    };
  }
  return {
    model: null,
    assistantCompatible: false,
    excludeReason: "Not NaturalHD or Ultra",
  };
}

/**
 * Query Telnyx live TTS catalog and return NaturalHD + Ultra voices that are
 * in the correct Assistants format (exclude Natural / short Ultra names).
 */
export async function listTelnyxAssistantCompatibleVoices() {
  const raw = await ai.listTextToSpeechVoices({ provider: "telnyx" });
  const rows = asVoiceRows(raw);
  const naturalHd: TelnyxCatalogVoice[] = [];
  const ultra: TelnyxCatalogVoice[] = [];
  const excluded: TelnyxCatalogVoice[] = [];

  for (const row of rows) {
    const providerVoiceId =
      normalizeTelnyxProviderVoiceId(String(row.voice_id || "")) ||
      (String(row.voice_id || "").startsWith("Telnyx.")
        ? String(row.voice_id)
        : null);
    if (!providerVoiceId) {
      excluded.push({
        ...row,
        assistantCompatible: false,
        excludeReason: "Unrecognized voice_id shape",
      });
      continue;
    }
    const cls = classifyAssistantVoice(providerVoiceId);
    const enriched: TelnyxCatalogVoice = {
      ...row,
      providerVoiceId,
      model: cls.model || undefined,
      assistantCompatible: cls.assistantCompatible,
      excludeReason: cls.excludeReason,
    };
    if (cls.model === "NaturalHD" && cls.assistantCompatible) {
      naturalHd.push(enriched);
    } else if (cls.model === "Ultra" && cls.assistantCompatible) {
      ultra.push(enriched);
    } else if (cls.model === "NaturalHD" || cls.model === "Ultra") {
      excluded.push(enriched);
    }
    // Ignore other Telnyx models (Natural, Kokoro, etc.) entirely for this list.
  }

  const byName = (a: TelnyxCatalogVoice, b: TelnyxCatalogVoice) =>
    String(a.name || a.providerVoiceId || "").localeCompare(
      String(b.name || b.providerVoiceId || ""),
      undefined,
      { sensitivity: "base" },
    );
  naturalHd.sort(byName);
  ultra.sort(byName);

  return {
    queriedAt: new Date().toISOString(),
    source: "GET /v2/text-to-speech/voices?provider=telnyx",
    counts: {
      apiRows: rows.length,
      naturalHd: naturalHd.length,
      ultra: ultra.length,
      excludedShortOrUnrecognized: excluded.length,
    },
    naturalHd,
    ultra,
    excluded,
  };
}
