import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

async function main() {
  const { isTelnyxAudioTranscriptionConfigured, transcribeAudioUrlWithTelnyx } =
    await import("@/lib/transcription/telnyx-audio");
  const { telnyxInferenceChatCompletion, isTelnyxInferenceChatConfigured } =
    await import("@/lib/voice/telnyx/inference-chat");

  assert.equal(typeof isTelnyxAudioTranscriptionConfigured, "function");
  assert.equal(typeof transcribeAudioUrlWithTelnyx, "function");
  assert.equal(typeof telnyxInferenceChatCompletion, "function");
  assert.equal(typeof isTelnyxInferenceChatConfigured, "function");

  const serviceTs = read("src/lib/transcription/service.ts");
  assert.match(serviceTs, /transcribeAudioUrlWithTelnyx/, "voicemail path uses Telnyx STT");
  assert.match(serviceTs, /voicemail_message/, "branch on voicemail source type");

  const telnyxAudioTs = read("src/lib/transcription/telnyx-audio.ts");
  assert.match(telnyxAudioTs, /\/ai\/audio\/transcriptions/, "Telnyx audio transcriptions endpoint");

  const chatTs = read("src/lib/voice/telnyx/inference-chat.ts");
  assert.match(chatTs, /\/ai\/openai\/chat\/completions/, "Telnyx OpenAI-compatible chat");

  const postTs = read("src/lib/phone/voicemail-post-process.ts");
  assert.match(postTs, /telnyxInferenceChatCompletion/, "voicemail summary uses Telnyx when configured");

  console.log("test-voicemail-telnyx-inference-contract: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
