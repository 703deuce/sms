#!/usr/bin/env node
/**
 * Fetch ElevenLabs speech+music from production (has ELEVENLABS_KEY),
 * mix locally with FFmpeg into master + telephone-ready files.
 *
 * Usage: node scripts/generate-connection-greeting.mjs
 */
import { spawnSync } from "child_process";
import { mkdirSync, writeFileSync, readFileSync, statSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public", "connection-greeting");
const SOURCES = path.join(OUT, "sources");

const BASE = (process.env.BASE_URL || "https://transovo.ai").replace(/\/$/, "");
const BOOTSTRAP = "transovo-smoke-bootstrap-b56f-aug2026";
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "703deuce@gmail.com").trim().toLowerCase();

const MUSIC_UNDER_SPEECH_DB = -9; // audible on PSTN; was -21 (inaudible)
const SPEECH_DELAY_MS = 200; // 150–250ms speech start after music
const TARGET_DURATION_S = 4.8; // keep finished file ~4–5s

function cookieHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}
function storeCookies(jar, res) {
  for (const c of res.headers.getSetCookie?.() || []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
  }
}

async function api(jar, pathName, body) {
  const res = await fetch(`${BASE}${pathName}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(jar),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 800) };
  }
  return { res, json, status: res.status };
}

function ff(...args) {
  const r = spawnSync("ffmpeg", ["-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout);
    throw new Error(`ffmpeg failed: ${args.join(" ")}`);
  }
  return r;
}

function probeDuration(file) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nk=1:nw=1", file],
    { encoding: "utf8" },
  );
  return Number(String(r.stdout || "").trim()) || 0;
}

function fileInfo(file) {
  const st = statSync(file);
  return { path: file, bytes: st.size, durationSec: probeDuration(file) };
}

async function main() {
  mkdirSync(SOURCES, { recursive: true });
  const jar = new Map();

  const loginRes = await fetch(`${BASE}/api/auth/smoke-login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-smoke-bootstrap": BOOTSTRAP,
    },
    body: JSON.stringify({ email: OWNER_EMAIL }),
  });
  storeCookies(jar, loginRes);
  const login = await loginRes.json();
  if (!loginRes.ok || !login.ok) {
    throw new Error(`smoke-login failed: ${JSON.stringify(login).slice(0, 300)}`);
  }
  console.log("OK smoke-login");

  const gen = await api(jar, "/api/voice/ai", {
    action: "generate_connection_greeting_sources",
    writeFiles: false,
  });
  if (!gen.res.ok || !gen.json.data?.ok) {
    console.error(JSON.stringify(gen.json, null, 2).slice(0, 4000));
    throw new Error(gen.json.error || gen.json.data?.error || "generate failed");
  }
  const data = gen.json.data;
  console.log("OK generate sources", {
    voice: data.voice,
    speechBytes: data.speech?.bytes,
    musicBytes: data.music?.bytes,
  });

  const speechPath = path.join(SOURCES, "connection-greeting-speech-original.mp3");
  const musicPath = path.join(SOURCES, "connection-greeting-music-original.mp3");
  writeFileSync(speechPath, Buffer.from(data.speech.base64, "base64"));
  writeFileSync(musicPath, Buffer.from(data.music.base64, "base64"));

  // Decode sources to WAV for mixing
  const speechWav = path.join(SOURCES, "speech.wav");
  const musicWav = path.join(SOURCES, "music.wav");
  ff("-i", speechPath, "-ac", "1", "-ar", "44100", speechWav);
  ff("-i", musicPath, "-ac", "1", "-ar", "44100", musicWav);

  const speechDur = probeDuration(speechWav);
  const musicDur = probeDuration(musicWav);
  console.log("durations", { speechDur, musicDur });

  // Build bed: fade in 100ms, soft under speech via sidechain, fade out last 700ms, trim to ~4.8s
  const masterWav = path.join(OUT, "transovo-connection-greeting-master.wav");
  const phoneWav = path.join(OUT, "transovo-connection-greeting-phone.wav");
  const phoneMp3 = path.join(OUT, "transovo-connection-greeting-phone.mp3");

  const delaySec = SPEECH_DELAY_MS / 1000;
  const totalDur = Math.min(
    TARGET_DURATION_S,
    Math.max(speechDur + delaySec + 0.55, 4.2),
  );
  const fadeOutStart = Math.max(0, totalDur - 0.7);

  // Music bed: fade in 100ms, -21 dB under speech, fade out last 700ms, pad/trim to target.
  // Speech: start ~200ms after music, loudnorm for PSTN clarity.
  // Sidechain ducking + amix; duration=longest so we keep the full 4.8s bed.
  const filter = [
    `[0:a]afade=t=in:st=0:d=0.1,volume=${MUSIC_UNDER_SPEECH_DB}dB,apad=whole_dur=${totalDur},atrim=0:${totalDur},afade=t=out:st=${fadeOutStart}:d=0.7[bed]`,
    `[1:a]adelay=${SPEECH_DELAY_MS}|${SPEECH_DELAY_MS}:all=1,loudnorm=I=-16:TP=-1.5:LRA=11,apad=whole_dur=${totalDur},atrim=0:${totalDur}[spk]`,
    `[spk]asplit=2[spk_sc][spk_mix]`,
    `[bed][spk_sc]sidechaincompress=threshold=0.05:ratio=4:attack=30:release=300:makeup=1:knee=2.82843[ducked]`,
    `[ducked][spk_mix]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95:level=disabled[out]`,
  ].join(";");

  const ffmpegCmd = [
    "ffmpeg",
    "-y",
    "-i",
    musicWav,
    "-i",
    speechWav,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-ar",
    "44100",
    "-ac",
    "1",
    masterWav,
  ];
  console.log("FFmpeg:", ffmpegCmd.join(" "));
  ff(
    "-i",
    musicWav,
    "-i",
    speechWav,
    "-filter_complex",
    filter,
    "-map",
    "[out]",
    "-ar",
    "44100",
    "-ac",
    "1",
    masterWav,
  );

  // Telephone-ready: mono 8kHz PCM WAV + MP3 fallback
  ff("-i", masterWav, "-ac", "1", "-ar", "8000", "-sample_fmt", "s16", phoneWav);
  ff("-i", masterWav, "-ac", "1", "-ar", "22050", "-b:a", "64k", phoneMp3);

  const manifest = {
    generatedAt: new Date().toISOString(),
    text: data.text,
    voice: data.voice,
    ttsRequest: data.ttsRequest,
    musicRequest: data.musicRequest,
    ffmpegFilterComplex: filter,
    speechDelayMs: SPEECH_DELAY_MS,
    musicUnderSpeechDb: MUSIC_UNDER_SPEECH_DB,
    targetDurationSec: totalDur,
    sources: {
      speech: fileInfo(speechPath),
      music: fileInfo(musicPath),
    },
    outputs: {
      masterWav: fileInfo(masterWav),
      phoneWav: fileInfo(phoneWav),
      phoneMp3: fileInfo(phoneMp3),
    },
    publicUrls: {
      phoneMp3: "/connection-greeting/transovo-connection-greeting-phone.mp3",
      phoneWav: "/connection-greeting/transovo-connection-greeting-phone.wav",
      masterWav: "/connection-greeting/transovo-connection-greeting-master.wav",
    },
  };
  writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
