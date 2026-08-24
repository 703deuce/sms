/**
 * Generate default Transovo hold-music library via ElevenLabs Music API.
 * Run: npx tsx scripts/generate-default-hold-music.mjs
 * Options: --force to regenerate existing tracks
 */
import assert from "node:assert/strict";
import { access, mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  HOLD_MUSIC_TRACKS,
  DEFAULT_HOLD_MUSIC_SLUG,
} from "../src/lib/smart-routing/hold-music-library.ts";
import { composeElevenMusic, isElevenLabsConfigured } from "../src/lib/voice/elevenlabs/client.ts";

const force = process.argv.includes("--force");
const outDir = path.join(process.cwd(), "public", "smart-routing-audio", "system");

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!isElevenLabsConfigured()) {
    console.error("ELEVENLABS_KEY not configured — cannot generate hold music.");
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  const manifest = [];

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const track of HOLD_MUSIC_TRACKS) {
    const filePath = path.join(outDir, `${track.slug}.mp3`);
    if (!force && (await exists(filePath))) {
      console.log(`${track.title} — existing/skipped`);
      skipped += 1;
      manifest.push({
        slug: track.slug,
        title: track.title,
        file: `${track.slug}.mp3`,
        durationMs: track.musicLengthMs,
        generatedAt: "existing",
        source: "elevenlabs",
      });
      continue;
    }

    try {
      console.log(`${track.title} — generating…`);
      const audio = await composeElevenMusic({
        prompt: track.prompt,
        musicLengthMs: track.musicLengthMs,
        forceInstrumental: true,
      });
      const buf = Buffer.from(audio);
      assert.ok(buf.length > 1000, `${track.slug}: file too small`);
      await writeFile(filePath, buf);
      manifest.push({
        slug: track.slug,
        title: track.title,
        file: `${track.slug}.mp3`,
        durationMs: track.musicLengthMs,
        generatedAt: new Date().toISOString(),
        source: "elevenlabs",
      });
      generated += 1;
      console.log(`${track.title} — generated (${buf.length} bytes)`);
    } catch (err) {
      failed += 1;
      console.error(`${track.title} — FAILED:`, err instanceof Error ? err.message : err);
    }
  }

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ tracks: manifest, defaultSlug: DEFAULT_HOLD_MUSIC_SLUG }, null, 2),
  );

  console.log(
    `\nHold music: ${generated} generated, ${skipped} skipped, ${failed} failed (${HOLD_MUSIC_TRACKS.length} total)`,
  );
  if (failed > 0) process.exit(1);
}

main();
