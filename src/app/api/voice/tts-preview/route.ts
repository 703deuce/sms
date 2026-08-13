import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getTelnyxApiBaseUrl, getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import {
  DEFAULT_VOICE_PREVIEW_TEXT,
  getCuratedVoice,
  isApprovedVoiceId,
  resolvePreviewVoiceId,
} from "@/lib/voice/telnyx/voices";
import { getCachedPreview, setCachedPreview } from "@/lib/voice/platform/preview-cache";
import {
  isReceptionistElevenLabsVoiceId,
  RECEPTIONIST_TTS_MODEL,
} from "@/lib/voice/elevenlabs/receptionist-voice-catalog";
import { synthesizeElevenLabsSpeech } from "@/lib/voice/elevenlabs/client";
import { maybeNormalizeForElevenLabsModel } from "@/lib/voice/elevenlabs/normalize-tts-text";

const previewHits = new Map<string, { count: number; windowStart: number }>();

function previewRateOk(userId: string, limit = 30) {
  const now = Date.now();
  const row = previewHits.get(userId);
  if (!row || now - row.windowStart > 60_000) {
    previewHits.set(userId, { count: 1, windowStart: now });
    return true;
  }
  if (row.count >= limit) return false;
  row.count += 1;
  return true;
}

/**
 * Preview a curated Telnyx voice (real Ultra/NaturalHD — never browser speechSynthesis).
 * Only approved catalog / Telnyx provider IDs are accepted.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    if (!previewRateOk(auth.session.userId)) {
      return NextResponse.json(
        { error: "Too many voice previews — wait a minute and try again." },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      text?: string;
      voice?: string;
      language?: string;
      speed?: number;
    };

    const requested = String(body.voice || "").trim();
    const text = (body.text || DEFAULT_VOICE_PREVIEW_TEXT).trim().slice(0, 280);
    const language = (body.language || "en-US").trim();
    const speed =
      typeof body.speed === "number" && Number.isFinite(body.speed)
        ? Math.min(2, Math.max(0.5, body.speed))
        : 1;

    if (isReceptionistElevenLabsVoiceId(requested)) {
      const voiceId = requested;
      const spokenText = maybeNormalizeForElevenLabsModel(text, RECEPTIONIST_TTS_MODEL);
      const cached = await getCachedPreview({
        voiceId,
        text: spokenText,
        speed,
      });
      if (cached) {
        return NextResponse.json({
          data: {
            mode: "cache",
            text: spokenText,
            voice: voiceId,
            provider: "elevenlabs",
            model: RECEPTIONIST_TTS_MODEL,
            language,
            audioUrl: cached,
            cached: true,
          },
        });
      }

      try {
        const audio = await synthesizeElevenLabsSpeech({
          voiceId,
          text: spokenText,
          modelId: RECEPTIONIST_TTS_MODEL,
        });
        const audioUrl = `data:audio/mpeg;base64,${Buffer.from(new Uint8Array(audio)).toString("base64")}`;
        await setCachedPreview({ voiceId, text: spokenText, speed, audioUrl });
        return NextResponse.json({
          data: {
            mode: "elevenlabs",
            text: spokenText,
            voice: voiceId,
            provider: "elevenlabs",
            model: RECEPTIONIST_TTS_MODEL,
            language,
            audioUrl,
            cached: false,
          },
        });
      } catch (err) {
        return NextResponse.json(
          {
            error: "Could not preview this ElevenLabs voice. Use Test in browser instead.",
            detail: err instanceof Error ? err.message : String(err),
            voice: voiceId,
          },
          { status: 502 },
        );
      }
    }

    if (!requested || !isApprovedVoiceId(requested)) {
      return NextResponse.json(
        { error: "Voice is not in the approved catalog." },
        { status: 400 },
      );
    }

    const curated = getCuratedVoice(requested);
    // Use raw Ultra/xAI ids for preview compare; do not map to NaturalHD here.
    const providerVoice = resolvePreviewVoiceId(requested);

    const cached = await getCachedPreview({
      voiceId: providerVoice,
      text,
      speed,
    });
    if (cached) {
      return NextResponse.json({
        data: {
          mode: "cache",
          text,
          voice: providerVoice,
          catalogId: curated?.catalogId || null,
          language,
          audioUrl: cached,
          cached: true,
        },
      });
    }

    const apiKey = getTelnyxApiKey();
    if (!apiKey) {
      return NextResponse.json({
        data: {
          mode: "mock",
          text,
          voice: providerVoice,
          catalogId: curated?.catalogId || null,
          language,
          message: "Telnyx not configured — cannot preview voice audio.",
        },
      });
    }

    const base = getTelnyxApiBaseUrl();
    const attempts: Array<{ path: string; body: Record<string, unknown> }> = [
      {
        path: "/text-to-speech/speech",
        body: {
          text,
          voice: providerVoice,
          language,
          output_type: "base64_output",
          voice_settings: { voice_speed: speed },
        },
      },
      {
        path: "/text-to-speech",
        body: {
          text,
          voice: providerVoice,
          language,
          output_format: "mp3",
          voice_speed: speed,
        },
      },
    ];

    let lastError = "";
    for (const attempt of attempts) {
      try {
        const res = await fetch(`${base}${attempt.path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json, audio/mpeg, audio/*",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(attempt.body),
        });
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok) {
          const errText = await res.text();
          lastError = `${attempt.path} ${res.status}: ${errText.slice(0, 200)}`;
          continue;
        }

        let audioUrl = "";
        if (contentType.includes("audio")) {
          const buf = Buffer.from(await res.arrayBuffer());
          const mime = contentType.split(";")[0] || "audio/mpeg";
          audioUrl = `data:${mime};base64,${buf.toString("base64")}`;
        } else {
          const json = (await res.json()) as Record<string, unknown>;
          const data = (json.data || json) as Record<string, unknown>;
          const b64 =
            (data.audio as string) ||
            (data.audio_base64 as string) ||
            (data.base64 as string) ||
            "";
          const url =
            (data.audio_url as string) ||
            (data.url as string) ||
            (data.media_url as string) ||
            "";
          if (b64) {
            audioUrl = b64.startsWith("data:")
              ? b64
              : `data:audio/mpeg;base64,${b64}`;
          } else if (url) {
            audioUrl = url;
          } else {
            lastError = `${attempt.path}: no audio in response`;
            continue;
          }
        }

        await setCachedPreview({
          voiceId: providerVoice,
          text,
          speed,
          audioUrl,
        });

        return NextResponse.json({
          data: {
            mode: "telnyx",
            text,
            voice: providerVoice,
            catalogId: curated?.catalogId || null,
            language,
            audioUrl,
            cached: false,
          },
        });
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return NextResponse.json(
      {
        error: "This voice is temporarily unavailable. Choose another voice.",
        detail: lastError.slice(0, 400),
        voice: providerVoice,
      },
      { status: 502 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}
