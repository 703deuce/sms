/**
 * Generate connection-greeting speech + music assets via ElevenLabs.
 * Mixing is done with FFmpeg (local or server) — never live per call.
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import {
  composeElevenMusic,
  listElevenLabsVoices,
  synthesizeElevenLabsSpeech,
} from "@/lib/voice/elevenlabs/client";
import {
  CONNECTION_GREETING_MUSIC_LENGTH_MS,
  CONNECTION_GREETING_MUSIC_PROMPT,
  CONNECTION_GREETING_TEXT,
  CONNECTION_GREETING_TTS_MODEL,
  CONNECTION_GREETING_TTS_SETTINGS,
  CONNECTION_GREETING_VOICE_ID,
  CONNECTION_GREETING_VOICE_NAME,
} from "./constants";

function bufToBase64(buf: ArrayBuffer) {
  return Buffer.from(buf).toString("base64");
}

export async function confirmAlexandraVoice() {
  const voices = await listElevenLabsVoices();
  const exact = voices.find((v) => v.voice_id === CONNECTION_GREETING_VOICE_ID);
  if (exact) {
    return {
      ok: true as const,
      voice: exact,
      alternatives: [] as typeof voices,
    };
  }
  const alternatives = voices.filter((v) => {
    const gender = String(v.labels?.gender || "").toLowerCase();
    const use = String(v.labels?.use_case || "").toLowerCase();
    const cat = String(v.category || "").toLowerCase();
    const female = gender.includes("female") || gender === "f";
    const conversational =
      use.includes("conversational") || cat.includes("professional");
    return female && conversational;
  });
  return {
    ok: false as const,
    voice: null,
    alternatives: alternatives.slice(0, 20),
    error: `Alexandra voice ID ${CONNECTION_GREETING_VOICE_ID} is not available on this ElevenLabs account. Do not substitute silently.`,
  };
}

export async function generateConnectionGreetingSources(input?: {
  outDir?: string;
  writeFiles?: boolean;
}) {
  const confirm = await confirmAlexandraVoice();
  if (!confirm.ok) {
    return {
      ok: false as const,
      error: confirm.error,
      alternatives: confirm.alternatives.map((v) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        description: v.description,
        labels: v.labels,
      })),
    };
  }

  const ttsRequest = {
    voiceId: CONNECTION_GREETING_VOICE_ID,
    modelId: CONNECTION_GREETING_TTS_MODEL,
    text: CONNECTION_GREETING_TEXT,
    outputFormat: "mp3_44100_192",
    stability: CONNECTION_GREETING_TTS_SETTINGS.stability,
    similarityBoost: CONNECTION_GREETING_TTS_SETTINGS.similarityBoost,
    // v3 reports can_use_style/speaker_boost false — omit unsupported knobs
    // but keep settings documented; send only stability/similarity for v3.
  };

  const musicRequest = {
    prompt: CONNECTION_GREETING_MUSIC_PROMPT,
    musicLengthMs: CONNECTION_GREETING_MUSIC_LENGTH_MS,
    forceInstrumental: true,
    modelId: "music_v1",
    outputFormat: "mp3_44100_128",
  };

  const speechBuf = await synthesizeElevenLabsSpeech({
    ...ttsRequest,
    // eleven_v3: style/speaker_boost not supported on account capabilities
  });
  const musicBuf = await composeElevenMusic(musicRequest);

  const outDir =
    input?.outDir ||
    path.join(process.cwd(), "public", "connection-greeting", "sources");
  const speechPath = path.join(outDir, "connection-greeting-speech-original.mp3");
  const musicPath = path.join(outDir, "connection-greeting-music-original.mp3");

  if (input?.writeFiles !== false) {
    await mkdir(outDir, { recursive: true });
    await writeFile(speechPath, Buffer.from(speechBuf));
    await writeFile(musicPath, Buffer.from(musicBuf));
  }

  return {
    ok: true as const,
    voice: {
      id: CONNECTION_GREETING_VOICE_ID,
      name: confirm.voice?.name || CONNECTION_GREETING_VOICE_NAME,
      model: CONNECTION_GREETING_TTS_MODEL,
    },
    text: CONNECTION_GREETING_TEXT,
    ttsRequest,
    musicRequest,
    speech: {
      path: speechPath,
      bytes: speechBuf.byteLength,
      base64: bufToBase64(speechBuf),
      contentType: "audio/mpeg",
    },
    music: {
      path: musicPath,
      bytes: musicBuf.byteLength,
      base64: bufToBase64(musicBuf),
      contentType: "audio/mpeg",
    },
  };
}
