#!/usr/bin/env tsx
/**
 * Reminder idempotency + lifecycle unit tests.
 * Run: npx tsx scripts/test-appointments-reminder-state.ts
 */
import assert from "node:assert/strict";
import {
  currentReminderGeneration,
  markReminderSentInMeta,
  reminderTimelineType,
  resetAppointmentReminders,
  suppressAppointmentReminders,
  wasReminderSent,
} from "../src/lib/appointments/reminder-state";

function testIdempotentReminderKeys() {
  let meta = resetAppointmentReminders({});
  const type = reminderTimelineType("reminder24h", 1440);
  assert.equal(wasReminderSent(meta, type), false);
  meta = markReminderSentInMeta(meta, type);
  assert.equal(wasReminderSent(meta, type), true);
  meta = resetAppointmentReminders(meta);
  assert.equal(wasReminderSent(meta, type), false);
  assert.equal(currentReminderGeneration(meta), 3);
  console.log("PASS reminder idempotency across generations");
}

function testSuppressOnCancel() {
  const meta = suppressAppointmentReminders({ reminderGeneration: 1 });
  assert.equal(meta.remindersSuppressed, true);
  assert.equal(meta.reminderStatus, "canceled");
  console.log("PASS suppress clears reminders");
}

function testConfigurableTimelineType() {
  const type = reminderTimelineType("reminder2h", 90);
  assert.equal(type, "reminder_90m_sent");
  console.log("PASS configurable reminder timeline type");
}

testIdempotentReminderKeys();
testSuppressOnCancel();
testConfigurableTimelineType();
console.log("\nAll reminder state tests passed.");
