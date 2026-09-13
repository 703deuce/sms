#!/usr/bin/env tsx
/**
 * Voice outbound SMS From resolution — voice DID vs texting DID.
 * npx tsx scripts/test-voice-outbound-sms-from.ts
 */
import assert from "node:assert/strict";
import {
  buildDefaultOutboundSmsMessaging,
  effectiveOutboundSmsMode,
  isTollFreeE164,
  parseVoiceOutboundSmsSettings,
} from "../src/lib/voice/sms/voice-outbound-sms-config";
import { HP_CERTIFIED_SMS_E164 } from "../src/lib/messaging/preferred-sending-number";
import { resolveVoiceOutboundSmsFromE164 } from "../src/lib/voice/sms/voice-outbound-sms-from";

function main() {
  assert.equal(isTollFreeE164("+18663464256"), true);
  assert.equal(isTollFreeE164("+15714073615"), false);

  const tollFreeVoice = buildDefaultOutboundSmsMessaging({
    voiceInboundE164: "+18663464256",
  });
  const tfSettings = parseVoiceOutboundSmsSettings({ messaging: tollFreeVoice });
  assert.equal(effectiveOutboundSmsMode(tfSettings), "workspace_preferred");

  const localVoice = buildDefaultOutboundSmsMessaging({
    voiceInboundE164: "+15714073615",
  });
  const localSettings = parseVoiceOutboundSmsSettings({ messaging: localVoice });
  assert.equal(effectiveOutboundSmsMode(localSettings), "same_as_voice_line");

  const explicit = buildDefaultOutboundSmsMessaging({
    voiceInboundE164: "+18663464256",
    dedicatedE164: HP_CERTIFIED_SMS_E164,
  });
  const exSettings = parseVoiceOutboundSmsSettings({ messaging: explicit });
  assert.equal(effectiveOutboundSmsMode(exSettings), "explicit_number");
  assert.equal(exSettings.e164, HP_CERTIFIED_SMS_E164);

  const envFrom = resolveVoiceOutboundSmsFromE164();
  assert.ok(envFrom.startsWith("+1"), `expected E.164 default, got ${envFrom}`);

  console.log("test-voice-outbound-sms-from: PASS");
  console.log(`  default env/cert sender: ${envFrom}`);
  console.log(`  866 voice → mode ${effectiveOutboundSmsMode(tfSettings)}`);
  console.log(`  571 voice → mode ${effectiveOutboundSmsMode(localSettings)}`);
}

main();
