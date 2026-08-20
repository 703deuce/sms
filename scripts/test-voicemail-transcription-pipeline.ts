/**
 * Voicemail transcription + provider routing contracts.
 * Run: npx tsx scripts/test-voicemail-transcription-pipeline.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

async function main() {
  const voicemailService = read("src/lib/phone/voicemail-service.ts");
  assert.ok(voicemailService.includes("transcription: true"));
  assert.ok(voicemailService.includes("transcription_engine"));
  assert.ok(voicemailService.includes("awaitNativeTranscription"));
  assert.ok(voicemailService.includes("fallbackVoicemailWhisperIfStillPending"));

  const telnyxPipeline = read("src/lib/phone/telnyx-voicemail-pipeline.ts");
  assert.ok(
    telnyxPipeline.includes("call.recording.transcription.saved") ||
      telnyxPipeline.includes("parseTelnyxRecordingTranscriptionPayload"),
  );
  assert.ok(telnyxPipeline.includes("applyTelnyxVoicemailTranscription"));
  assert.ok(telnyxPipeline.includes("Transcription processing"));

  const humanCall = read("src/lib/phone/human-call-service.ts");
  assert.ok(humanCall.includes("call.recording.transcription.saved"));
  assert.ok(humanCall.includes("call.recording.error"));

  const twilioVoice = read("src/lib/numbers/providers/voice/twilio-personal-voice.ts");
  assert.ok(twilioVoice.includes('transcribe="true"'));
  assert.ok(twilioVoice.includes("assertPhoneNumberProvider"));

  const twilioPipeline = read("src/lib/phone/twilio-voicemail-pipeline.ts");
  assert.ok(twilioPipeline.includes("applyTwilioVoicemailTranscription"));
  assert.ok(twilioPipeline.includes("TRANSCRIPTION_PROCESSING"));

  const twilioTranscriptionRoute = read("src/app/api/webhooks/twilio/voice/transcription/route.ts");
  assert.ok(twilioTranscriptionRoute.includes("verifyTwilioVoiceWebhookSignature"));
  assert.ok(twilioTranscriptionRoute.includes("applyTwilioVoicemailTranscription"));

  const { parseTelnyxRecordingTranscriptionPayload, isTranscriptionPending } = await import(
    "../src/lib/phone/telnyx-voicemail-pipeline.ts"
  );

  const parsed = parseTelnyxRecordingTranscriptionPayload({
    transcription_data: { transcript: "Hello from Telnyx" },
    transcription_id: "tx_123",
  });
  assert.equal(parsed?.transcript, "Hello from Telnyx");
  assert.equal(parsed?.transcriptionId, "tx_123");

  assert.equal(isTranscriptionPending(null), true);
  assert.equal(isTranscriptionPending("Transcription processing…"), true);
  assert.equal(isTranscriptionPending("Hello caller"), false);

  const providerGuard = read("src/lib/numbers/providers/provider-guard.ts");
  assert.ok(providerGuard.includes("ProviderMismatchError"));
  assert.ok(providerGuard.includes("assertPhoneNumberProvider"));

  console.log("test-voicemail-transcription-pipeline: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
