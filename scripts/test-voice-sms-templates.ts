/**
 * Deterministic voice SMS template tests.
 * Run: npx tsx scripts/test-voice-sms-templates.ts
 */
import {
  resolveVoiceSmsTemplate,
  VOICE_SMS_TEMPLATE_IDS,
} from "../src/lib/voice/sms/voice-sms-templates";

const failures: string[] = [];
function check(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
  else console.log("✓", name);
}

function main() {
  for (const id of VOICE_SMS_TEMPLATE_IDS) {
    const resolved = resolveVoiceSmsTemplate({
      templateId: id,
      callId: "call_test_123",
      businessName: "Test Plumbing",
      bookingUrl: "https://example.com/book",
    });
    check(`${id} resolves`, resolved.body.length > 20);
    check(`${id} idempotency key stable`, resolved.idempotencyKey === `call_test_123:sms:${id}:v1`);
    check(`${id} includes business name`, resolved.body.includes("Test Plumbing"));
  }

  const booking = resolveVoiceSmsTemplate({
    templateId: "booking_link",
    callId: "call_1",
    bookingUrl: "https://example.com/schedule",
  });
  check("booking link includes URL", booking.body.includes("https://example.com/schedule"));

  let threw = false;
  try {
    resolveVoiceSmsTemplate({ templateId: "not_a_template", callId: "call_1" });
  } catch {
    threw = true;
  }
  check("unknown template throws", threw);

  if (failures.length) {
    console.error(`\n${failures.length} failure(s):`, failures);
    process.exit(1);
  }
  console.log("\nVoice SMS template checks passed.");
}

main();
