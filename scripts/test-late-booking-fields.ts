#!/usr/bin/env npx tsx
import {
  bookingFailureNeedsFieldCollection,
  looksLikeSpokenEmail,
  resolveRecordFieldId,
} from "../src/lib/voice/domain-actions/late-booking-fields";
import { SYSTEM_FIELD_IDS } from "../src/lib/voice/field-runtime/system-fields";
import type { AmyRealtimeSession } from "../src/lib/voice/realtime-session/types";

const failures: string[] = [];

function check(name: string, cond: boolean) {
  if (!cond) {
    failures.push(name);
    console.error("✗", name);
  } else {
    console.log("✓", name);
  }
}

check(
  "detects email-related booking failure from speak text",
  bookingFailureNeedsFieldCollection({
    confirmed: true,
    result: {
      ok: false,
      speak: "I need an email address to confirm this appointment on the calendar.",
    },
    session: {
      collectedFields: {},
    } as AmyRealtimeSession,
  }),
);

check(
  "spoken email resolves to sys_email field id",
  resolveRecordFieldId({
    session: {
      collectedFields: {},
      missingFieldIds: [SYSTEM_FIELD_IDS.email],
      activeField: null,
    } as AmyRealtimeSession,
    value: "anthony at gmail dot com",
  }) === SYSTEM_FIELD_IDS.email,
);

check(
  "looksLikeSpokenEmail normalizes at/dot",
  looksLikeSpokenEmail("anthony at gmail dot com"),
);

console.log(`\nOVERALL: ${failures.length ? "FAIL" : "PASS"}`);
if (failures.length) process.exit(1);
