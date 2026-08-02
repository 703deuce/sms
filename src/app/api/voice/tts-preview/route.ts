import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getTelnyxApiBaseUrl, getTelnyxApiKey } from "@/lib/messaging/telnyx/config";
import { DEFAULT_AGENT_VOICE_ID } from "@/lib/voice/telnyx/voices";

/**
 * Preview a Telnyx TTS voice (real Ultra/NaturalHD audio — not browser speechSynthesis).
 * Returns a data:audio URL when Telnyx streams MPEG bytes.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as {
      text?: string;
      voice?: string;
      language?: string;
    };
    const text = (body.text || "Hi, thanks for calling. This is how I sound.")
      .trim()
      .slice(0, 280);
    const voice = (body.voice || DEFAULT_AGENT_VOICE_ID).trim();
    const language = (body.language || "en-US").trim();
    const apiKey = getTelnyxApiKey();

    if (!apiKey) {
      return NextResponse.json({
        data: {
          mode: "mock",
          text,
          voice,
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
          voice,
          language,
          output_type: "base64_output",
        },
      },
      {
        path: "/text-to-speech",
        body: {
          text,
          voice,
          language,
          output_format: "mp3",
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

        if (contentType.includes("audio")) {
          const buf = Buffer.from(await res.arrayBuffer());
          const mime = contentType.split(";")[0] || "audio/mpeg";
          const audioUrl = `data:${mime};base64,${buf.toString("base64")}`;
          return NextResponse.json({
            data: { mode: "telnyx", text, voice, language, audioUrl },
          });
        }

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
          const audioUrl = b64.startsWith("data:")
            ? b64
            : `data:audio/mpeg;base64,${b64}`;
          return NextResponse.json({
            data: { mode: "telnyx", text, voice, language, audioUrl },
          });
        }
        if (url) {
          return NextResponse.json({
            data: { mode: "telnyx", text, voice, language, audioUrl: url },
          });
        }
        lastError = `${attempt.path}: no audio in response`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return NextResponse.json(
      {
        error: "Could not generate voice preview",
        detail: lastError.slice(0, 400),
        voice,
      },
      { status: 502 },
    );
  } catch (err) {
    return jsonError(err, 400);
  }
}
