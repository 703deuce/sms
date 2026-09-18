#!/usr/bin/env npx tsx
import { normalizeVoiceIntakeEmail } from "../src/lib/voice-receptionist-wizard/intake/normalize-email";

const failures: string[] = [];
function check(name: string, cond: boolean) {
  if (!cond) failures.push(name);
  else console.log("✓", name);
}

check(
  "spoken at dot",
  normalizeVoiceIntakeEmail("anthony at gmail dot com") === "anthony@gmail.com",
);
check(
  "spaced letters",
  normalizeVoiceIntakeEmail("a n t h o n y at g mail dot com") === "anthony@gmail.com",
);
check("already valid", normalizeVoiceIntakeEmail("Anthony@Example.COM") === "anthony@example.com");
check(
  "prefix strip",
  normalizeVoiceIntakeEmail("my email is bob at acme dot org") === "bob@acme.org",
);

if (failures.length) {
  console.error("FAIL:", failures);
  process.exit(1);
}
console.log("\nEmail intake checks passed.");
