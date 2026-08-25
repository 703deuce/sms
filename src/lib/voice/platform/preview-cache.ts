/**
 * In-process + disk cache for TTS voice preview clips.
 * Avoids regenerating the same Ultra/NaturalHD sample on every Play click.
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { previewCacheKey } from "./test-session";

const mem = new Map<string, { audioUrl: string; at: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;
const DIR = path.join("/tmp", "transovo-voice-previews");

async function ensureDir() {
  await mkdir(DIR, { recursive: true }).catch(() => undefined);
}

export async function getCachedPreview(input: {
  voiceId: string;
  text: string;
  speed?: number;
}): Promise<string | null> {
  const key = previewCacheKey(input.voiceId, input.text, input.speed);
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.audioUrl;

  try {
    await ensureDir();
    const file = path.join(DIR, `${key}.json`);
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { audioUrl?: string; at?: number };
    if (parsed.audioUrl && parsed.at && Date.now() - parsed.at < TTL_MS) {
      mem.set(key, { audioUrl: parsed.audioUrl, at: parsed.at });
      return parsed.audioUrl;
    }
  } catch {
    // miss
  }
  return null;
}

export async function setCachedPreview(input: {
  voiceId: string;
  text: string;
  speed?: number;
  audioUrl: string;
}) {
  const key = previewCacheKey(input.voiceId, input.text, input.speed);
  const at = Date.now();
  mem.set(key, { audioUrl: input.audioUrl, at });
  try {
    await ensureDir();
    await writeFile(
      path.join(DIR, `${key}.json`),
      JSON.stringify({ audioUrl: input.audioUrl, at, voiceId: input.voiceId }),
      "utf8",
    );
  } catch {
    // best-effort disk cache
  }
}
