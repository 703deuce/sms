#!/usr/bin/env node
/**
 * Compare curated Voice V2 wizard catalog to live ElevenLabs account voices.
 * Never prints API secrets.
 */
import { listElevenLabsVoices } from "../src/lib/voice/elevenlabs/client.ts";
import { VOICE_V2_WIZARD_ELEVENLABS_VOICES } from "../src/lib/solutions/appointment-receptionist/voice-v2-wizard-elevenlabs-catalog.ts";

async function main() {
  const voices = await listElevenLabsVoices();
  const byId = new Map(voices.map((v) => [v.voice_id, v.name]));
  let missing = 0;
  for (const row of VOICE_V2_WIZARD_ELEVENLABS_VOICES) {
    const found = byId.has(row.elevenLabsVoiceId);
    console.log(
      `${found ? "FOUND" : "MISSING"} ${row.label} (${row.elevenLabsVoiceId.slice(0, 6)}…)`,
    );
    if (!found) missing += 1;
  }
  if (missing > 0) {
    console.error(`CATALOG_HEALTH_FAIL missing=${missing}`);
    process.exit(1);
  }
  console.log("CATALOG_HEALTH_OK");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
