#!/usr/bin/env npx tsx
import { bookingSystemFieldIds } from "../src/lib/voice/field-runtime/loader";
import { SYSTEM_FIELD_IDS } from "../src/lib/voice/field-runtime/system-fields";

const failures: string[] = [];

function check(name: string, cond: boolean) {
  if (!cond) {
    failures.push(name);
    console.error("✗", name);
  } else {
    console.log("✓", name);
  }
}

const base = bookingSystemFieldIds(false);
check("base booking includes name", base.includes(SYSTEM_FIELD_IDS.name));
check("base booking includes phone", base.includes(SYSTEM_FIELD_IDS.phone));
check("base booking excludes email without calendly", !base.includes(SYSTEM_FIELD_IDS.email));

const calendly = bookingSystemFieldIds(true);
check("calendly booking includes email", calendly.includes(SYSTEM_FIELD_IDS.email));

console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"}`);
if (failures.length) process.exit(1);
