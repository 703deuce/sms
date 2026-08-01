import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { telnyxRequest } from "@/lib/messaging/telnyx/client";
import { getTelnyxApiKey } from "@/lib/messaging/telnyx/config";

/**
 * Preview a Telnyx TTS voice. Returns audio URL or a mock payload when Telnyx is unset.
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
    const text = (body.text || "Hello, this is a preview of your AI voice agent.").trim().slice(0, 500);
    const voice = (body.voice || "Telnyx.KokoroTTS.af").trim();
    const language = (body.language || "en-US").trim();

    if (!getTelnyxApiKey()) {
      return NextResponse.json({
        data: {
          mode: "mock",
          text,
          voice,
          language,
          message: "Telnyx not configured — preview text only.",
        },
      });
    }

    // Telnyx text-to-speech API (best-effort; falls back to speak-on-call style payload).
    try {
      const res = await telnyxRequest<{ data: { url?: string; media_url?: string } }>(
        "/text_to_speech",
        {
          method: "POST",
          body: {
            text,
            voice,
            language,
          },
        },
      );
      return NextResponse.json({
        data: {
          mode: "telnyx",
          text,
          voice,
          language,
          audioUrl: res.data?.url || res.data?.media_url || null,
        },
      });
    } catch {
      return NextResponse.json({
        data: {
          mode: "telnyx_speak_payload",
          text,
          voice,
          language,
          speakPayload: { payload: text, voice, language },
          message:
            "TTS endpoint unavailable; use this payload with Call Control speak on a live leg.",
        },
      });
    }
  } catch (err) {
    return jsonError(err, 400);
  }
}
