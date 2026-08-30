/**
 * Voice outbound SMS sender tests (866 inbound → 571 outbound).
 * Run: npx tsx scripts/test-voice-outbound-sms-from.ts
 */
import {
  HP_CERTIFIED_SMS_E164,
  resolveVoiceOutboundSmsFromE164,
  VOICE_OUTBOUND_SMS_E164,
} from "../src/lib/voice/sms/voice-outbound-sms-from";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

const savedEnv = process.env.VOICE_OUTBOUND_SMS_FROM_E164;
delete process.env.VOICE_OUTBOUND_SMS_FROM_E164;

check("default voice SMS sender is 571", VOICE_OUTBOUND_SMS_E164 === "+15714073615");
check(
  "resolveVoiceOutboundSmsFromE164 returns HP certified",
  resolveVoiceOutboundSmsFromE164() === HP_CERTIFIED_SMS_E164,
);

process.env.VOICE_OUTBOUND_SMS_FROM_E164 = "+15714073615";
check("env override accepted", resolveVoiceOutboundSmsFromE164() === "+15714073615");

if (savedEnv === undefined) delete process.env.VOICE_OUTBOUND_SMS_FROM_E164;
else process.env.VOICE_OUTBOUND_SMS_FROM_E164 = savedEnv;

if (failures.length) {
  console.error(`\n${failures.length} failure(s):`, failures);
  process.exit(1);
}
console.log("\nVoice outbound SMS sender checks passed.");
