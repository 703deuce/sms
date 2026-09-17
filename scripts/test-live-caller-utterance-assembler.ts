/**
 * Utterance assembler: silence estimate starts settle; deltas cancel/reopen; stable only after window.
 */
import { LiveCallerUtteranceAssembler } from "../src/lib/voice/telnyx/openai-live-bridge/live-caller-utterance-assembler";

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const stable: Array<{ text: string; revision: number }> = [];
  const asm = new LiveCallerUtteranceAssembler({
    callId: "test_call",
    stabilizeMs: 80,
    onStable: (u) => {
      stable.push({ text: u.text, revision: u.revision });
    },
  });

  asm.onCallerAudioStarted(100);
  asm.onTranscriptDelta("I need Friday", 110);
  asm.onCallerAudioEndedEstimate(120);
  await sleep(40);
  asm.onTranscriptDelta(" actually Thursday morning", 150);
  await sleep(120);

  if (stable.length !== 1) {
    console.error("FAIL expected one stable utterance", stable);
    process.exit(1);
  }
  if (!stable[0].text.includes("Thursday")) {
    console.error("FAIL expected correction in stable text", stable[0]);
    process.exit(1);
  }

  asm.dispose();
  console.log("PASS test-live-caller-utterance-assembler");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
