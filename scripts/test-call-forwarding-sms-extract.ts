/**
 * Live SMS extraction + verifier tests for Call Forwarding.
 * Usage: npx tsx scripts/test-call-forwarding-sms-extract.ts
 */
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), file);
  if (existsSync(p)) dotenv.config({ path: p });
}

import { extractCallDestinationFromSms, verifySmsCallExtraction } from "../src/lib/call-forwarding/sms-extract";

const PASS_CASES = [
  "7035551212",
  "Call 703-555-1212",
  "Call John at (703) 555-1212",
  "please call 703 555 1212",
];

const FAIL_CASES = [
  { body: "Call 7035551212 or 5715559999", reason: "ambiguous" },
  { body: "hey team meeting at 3pm", reason: "no number" },
];

async function main() {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    console.error("FAIL: OPENAI_API_KEY required (Call Forwarding SMS uses gpt-5-nano)");
    process.exit(1);
  }

  let failed = 0;
  for (const body of PASS_CASES) {
    const extract = await extractCallDestinationFromSms(body);
    if (!extract || extract.intent !== "place_call" || extract.ambiguous || !extract.destination) {
      console.error(`FAIL extract: "${body}"`, extract);
      failed++;
      continue;
    }
    const verify = await verifySmsCallExtraction(body, extract);
    if (!verify.approved || !verify.destination?.includes("7035551212")) {
      console.error(`FAIL verify: "${body}"`, verify);
      failed++;
      continue;
    }
    console.log(`PASS: "${body}" → ${verify.destination}`);
  }

  for (const { body, reason } of FAIL_CASES) {
    const extract = await extractCallDestinationFromSms(body);
    if (reason === "ambiguous") {
      if (extract?.intent === "place_call" && !extract.ambiguous) {
        const verify = await verifySmsCallExtraction(body, extract!);
        if (verify.approved) {
          console.error(`FAIL ambiguous: "${body}"`);
          failed++;
          continue;
        }
      }
      console.log(`PASS reject: "${body}" (${reason})`);
    } else {
      if (extract?.intent === "place_call" && extract.destination) {
        const verify = await verifySmsCallExtraction(body, extract);
        if (verify.approved) {
          console.error(`FAIL no-number: "${body}"`);
          failed++;
          continue;
        }
      }
      console.log(`PASS reject: "${body}" (${reason})`);
    }
  }

  const disagree = await verifySmsCallExtraction("7035551212", {
    intent: "place_call",
    destination: "+15715559999",
    ambiguous: false,
  });
  if (disagree.approved) {
    console.error("FAIL verifier disagreement");
    failed++;
  } else {
    console.log("PASS verifier rejects disagreement");
  }

  if (failed) process.exit(1);
  console.log("test:call-forwarding-sms-extract ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
