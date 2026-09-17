import { mergeLiveInputTranscriptText } from "../src/lib/voice/telnyx/openai-live-bridge/live-input-transcript-merge";

const failures: string[] = [];
function pass(name: string, cond: boolean, detail?: string) {
  if (!cond) failures.push(detail ? `${name}: ${detail}` : name);
}

function main() {
  let r = mergeLiveInputTranscriptText("", "Friday");
  pass("empty+delta", r.text === "Friday" && r.mode === "replace");

  r = mergeLiveInputTranscriptText("Friday", " morning");
  pass("incremental", r.text === "Friday morning" && r.mode === "append");

  r = mergeLiveInputTranscriptText("Friday", "Friday morning");
  pass("cumulative", r.text === "Friday morning" && r.mode === "replace");

  r = mergeLiveInputTranscriptText("Friday morning", " morning");
  pass("duplicate tail", r.mode === "noop");

  r = mergeLiveInputTranscriptText("Friday", "FridayFriday morning");
  pass("double buffer artifact", r.text === "Friday morning");

  r = mergeLiveInputTranscriptText("a", "b", {
    contentId: "item-2",
    previousContentId: "item-1",
  });
  pass("content id reset", r.text === "b" && r.mode === "reset");

  if (failures.length) {
    console.error("FAILURES:\n" + failures.map((f) => `  - ${f}`).join("\n"));
    process.exit(1);
  }
  console.log("PASS test-live-input-transcript-merge");
}

main();
