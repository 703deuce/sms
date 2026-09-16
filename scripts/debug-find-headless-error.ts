#!/usr/bin/env npx tsx
import { executeVoiceV2FindAvailability } from "../src/lib/voice-v2/find-availability";
import { localDatePlusDays } from "../src/lib/mctb/ai-booking/local-time-semantics";
import { loadMctbAiBookingConfig } from "../src/lib/mctb/ai-booking/config";

async function main() {
  const WORKSPACE_ID = process.env.WORKSPACE_ID || "ws_1";
  const cfg = await loadMctbAiBookingConfig(WORKSPACE_ID);
  const tz = cfg.timezone?.trim() || "America/New_York";
  const tomorrow = localDatePlusDays(new Date().toISOString(), tz, 1);
  const avail = await executeVoiceV2FindAvailability(
    { requested_date: tomorrow, time_window: { start: "12:00", end: "17:00" } },
    WORKSPACE_ID,
  );
  console.log(JSON.stringify(avail, null, 2));
}

main();
