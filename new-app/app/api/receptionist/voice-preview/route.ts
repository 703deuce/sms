import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getReceptionistOpenAiClient } from "@/lib/server/voice-v3/openai-client";
import { isGptLiveBuiltInVoice, normalizeGptLiveVoiceId } from "@/lib/voice/gpt-live-built-in-voices";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export const dynamic = "force-dynamic";

const PREVIEW_TEXT =
  "Thank you for calling. This is your AI receptionist. How may I help you today?";

export async function POST(request: Request) {
  try {
    await resolveWorkspaceId();
    const body = (await request.json()) as { voice?: string; text?: string };
    const voice = normalizeGptLiveVoiceId(String(body.voice || "marin"));
    if (!isGptLiveBuiltInVoice(voice)) {
      return NextResponse.json({ error: "Unsupported GPT-Live voice" }, { status: 400 });
    }
    const text = (body.text || PREVIEW_TEXT).trim().slice(0, 280);
    const client = getReceptionistOpenAiClient();
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
    });
    const buf = Buffer.from(await speech.arrayBuffer());
    const audioUrl = `data:audio/mpeg;base64,${buf.toString("base64")}`;
    return NextResponse.json({ data: { audioUrl, voice, text } });
  } catch (err) {
    return jsonError(err, 502);
  }
}
