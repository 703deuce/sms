/**
 * Regression: MCTB phone assignment vs automation pause/disable must stay separate.
 * SIP ingress must resolve assigned numbers even when MCTB automation is suppressed.
 * Paused/disabled must route to voicemail fallback, not consent/SMS or dead air.
 *
 * Run: npx tsx scripts/test-mctb-sip-automation-separation.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  isMctbAutomationActive,
  isMctbSchedulePaused,
  type MctbScheduleSettings,
} from "../src/lib/mctb/schedule";

const resolverSrc = readFileSync(
  resolve("src/lib/mctb/sip-ingress/resolver.ts"),
  "utf8",
);
const sessionSrc = readFileSync(
  resolve("src/lib/voice/python-runtime-bridge/mctb-sip-session.ts"),
  "utf8",
);
const productionSrc = readFileSync(
  resolve("voice-runtime-python/transovo_voice/session/mctb_sip_production.py"),
  "utf8",
);
const voicemailFallbackSrc = readFileSync(
  resolve("src/lib/voice/python-runtime-bridge/mctb-sip-voicemail-fallback.ts"),
  "utf8",
);
const voicemailSrc = readFileSync(
  resolve("voice-runtime-python/transovo_voice/session/mctb_voicemail_fallback.py"),
  "utf8",
);

assert.match(
  resolverSrc,
  /Paused\/disabled MCTB must still answer calls/,
  "resolver must document ingress vs automation separation",
);

assert.doesNotMatch(
  resolverSrc,
  /resolveWorkspaceForMctbPhoneAssignment[\s\S]*?enabled\s*===\s*true/,
  "phone assignment resolver must not require config.enabled",
);

assert.match(
  sessionSrc,
  /handlingMode:\s*MctbSipHandlingMode/,
  "session resolver must expose handlingMode",
);

assert.match(
  sessionSrc,
  /mctbAutomationActive/,
  "session resolver must expose mctbAutomationActive",
);

assert.match(
  sessionSrc,
  /voicemail_fallback/,
  "session resolver must support voicemail_fallback handling mode",
);

assert.match(
  sessionSrc,
  /resolveMctbVoicemailFallbackPlayback/,
  "paused session must resolve voicemail greeting playback",
);

assert.match(
  sessionSrc,
  /mctbAutomationSuppressed: true/,
  "press-1 consent path must hard-stop when automation is suppressed",
);

assert.match(
  productionSrc,
  /voicemail_fallback/,
  "production flow must branch to voicemail fallback when automation suppressed",
);

assert.match(
  sessionSrc,
  /needsVoicemailGreeting/,
  "session resolver must load voicemail for existing_consent and paused automation",
);

const targetSrc = readFileSync(
  resolve("src/lib/mctb/onboarding/demo-workspace-target.ts"),
  "utf8",
);
assert.match(
  targetSrc,
  /resolveLinkedPlatformDemoTenantWorkspace/,
  "platform demo routing must use linked tenant workspaces",
);

assert.match(
  productionSrc,
  /run_mctb_voicemail_terminal/,
  "production flow must play voicemail terminal phase for existing_consent",
);

assert.match(
  productionSrc,
  /existing_consent_voicemail_complete/,
  "existing_consent path must complete with voicemail disconnect reason",
);

assert.doesNotMatch(
  productionSrc,
  /press_1_not_received[\s\S]*run_mctb_voicemail_terminal/,
  "press-1 incomplete path must not fall through to voicemail terminal",
);

assert.match(
  voicemailSrc,
  /mctb_voicemail_fallback_started/,
  "voicemail fallback must log terminal path start",
);

assert.match(
  productionSrc,
  /session_task = asyncio.create_task/,
  "production flow must resolve session in parallel with answer sequence",
);

assert.match(
  productionSrc,
  /capture_task = asyncio.create_task/,
  "existing_consent must capture SMS in parallel with voicemail playback",
);

assert.match(
  voicemailSrc,
  /record_sip_voicemail_message/,
  "voicemail terminal must record caller audio instead of sleeping",
);

assert.match(
  voicemailFallbackSrc,
  /Never generate TTS on the inbound hot path/,
  "voicemail greeting resolver must not generate TTS on inbound calls",
);

assert.match(
  voicemailSrc,
  /voicemail_fallback_complete/,
  "voicemail fallback must complete with explicit disconnect reason",
);

const baseSettings: MctbScheduleSettings = {
  scheduleMode: "always_on",
  weeklySchedule: null,
  pauseUntil: null,
};

const now = new Date("2026-08-25T12:00:00.000Z");
const futurePause = new Date("2026-08-25T18:00:00.000Z").toISOString();
const pastPause = new Date("2026-08-25T08:00:00.000Z").toISOString();

assert.equal(
  isMctbAutomationActive(baseSettings, { enabled: true }, now),
  true,
  "enabled=true with no pause → automation active",
);
assert.equal(
  isMctbSchedulePaused(baseSettings, { enabled: true }, now),
  false,
  "enabled=true with no pause → not paused",
);

assert.equal(
  isMctbAutomationActive(baseSettings, { enabled: false }, now),
  false,
  "enabled=false → automation suppressed",
);
assert.equal(
  isMctbSchedulePaused(baseSettings, { enabled: false }, now),
  true,
  "enabled=false → paused",
);

assert.equal(
  isMctbAutomationActive(
    { ...baseSettings, pauseUntil: futurePause },
    { enabled: true },
    now,
  ),
  false,
  "temporary pause → automation suppressed",
);
assert.equal(
  isMctbAutomationActive(
    { ...baseSettings, pauseUntil: pastPause },
    { enabled: true },
    now,
  ),
  true,
  "expired pause → automation active again",
);

console.log("test-mctb-sip-automation-separation: ok");
