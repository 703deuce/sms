#!/usr/bin/env npx tsx
import { captureIntakeFieldPayload } from "../src/lib/voice-v2/intake/validate-fields";
import { compileVoiceV2IntakeSchema } from "../src/lib/voice-v2/intake/compile-schema";

const failures: string[] = [];
function check(name: string, cond: boolean) {
  if (!cond) failures.push(name);
  else console.log("✓", name);
}

const schema = compileVoiceV2IntakeSchema({
  advanced: {
    voiceV2Intake: {
      fields: {
        email: { enabled: true, requirementLevel: "REQUIRED_BEFORE_BOOKING" },
        name: { enabled: true, requirementLevel: "OPTIONAL" },
      },
    },
  },
} as Parameters<typeof compileVoiceV2IntakeSchema>[0]);

function cap(fields: Record<string, string>) {
  return captureIntakeFieldPayload(schema, fields);
}

check(
  "literal @ stored raw",
  cap({ email: "anthony@example.com" }).ok &&
    cap({ email: "anthony@example.com" }).normalized?.email === "anthony@example.com",
);
check(
  "unusual email stored raw",
  cap({ email: "bob@localhost" }).ok && cap({ email: "bob@localhost" }).normalized?.email === "bob@localhost",
);
check(
  "partial domain stored raw",
  cap({ email: "anthony@example" }).ok &&
    cap({ email: "anthony@example" }).normalized?.email === "anthony@example",
);
check(
  "spoken email stored raw (not rejected)",
  cap({ email: "anthony at example dot com" }).ok &&
    cap({ email: "anthony at example dot com" }).normalized?.email === "anthony at example dot com",
);
check("single-letter name", cap({ name: "Q" }).ok);
check("unusual business name as custom", cap({ name: "!!! Plumbing" }).ok);
check("empty email = no capture", !cap({ email: "" }).ok);

if (failures.length) {
  console.error("FAIL:", failures);
  process.exit(1);
}
console.log("\nVoice V2 intake presence capture checks passed.");
