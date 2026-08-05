/**
 * Spoken relative datetime resolution for voice booking.
 * Run: npx tsx scripts/test-resolve-datetime.ts
 */
import assert from "node:assert/strict";
import { resolveSpokenDatetime } from "../src/lib/voice/calendar/resolve-datetime";

function section(name: string) {
  console.log(`\n== ${name} ==`);
}

const NOW = new Date("2026-08-05T18:15:00.000Z"); // Wed 2:15 PM EDT

section("tomorrow at 2pm");
{
  const r = resolveSpokenDatetime({
    spoken: "tomorrow at 2pm",
    timezone: "America/New_York",
    now: NOW,
  });
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("expected ok");
  assert.equal(r.clock.current_date, "2026-08-05");
  assert.equal(r.clock.current_day, "Wednesday");
  assert.match(r.resolvedLocal || "", /Thursday/);
  assert.match(r.resolvedLocal || "", /2026-08-06/);
  assert.match(r.resolvedLocal || "", /2:00 PM/);
  assert.equal(r.confidence, "high");
}

section("in three hours");
{
  const r = resolveSpokenDatetime({
    spoken: "in three hours",
    timezone: "America/New_York",
    now: NOW,
  });
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("expected ok");
  // 2:15 PM + 3h = 5:15 PM same day
  assert.match(r.resolvedLocal || "", /Wednesday/);
  assert.match(r.resolvedLocal || "", /5:15 PM/);
  assert.equal(r.confidence, "high");
}

section("this Friday morning");
{
  const r = resolveSpokenDatetime({
    spoken: "this Friday morning",
    timezone: "America/New_York",
    now: NOW,
  });
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("expected ok");
  assert.match(r.resolvedLocal || "", /Friday/);
  assert.match(r.resolvedLocal || "", /2026-08-07/);
  assert.match(r.resolvedLocal || "", /9:00 AM/);
}

section("business clock phrase");
{
  const r = resolveSpokenDatetime({
    spoken: "what day is it",
    timezone: "America/New_York",
    now: NOW,
  });
  assert.equal(r.ok, true);
  if (!r.ok) throw new Error("expected ok");
  assert.match(r.speak, /Wednesday/);
  assert.match(r.speak, /2026-08-05/);
}

section("empty spoken returns clock in speak");
{
  const r = resolveSpokenDatetime({
    spoken: "",
    timezone: "America/New_York",
    now: NOW,
  });
  assert.equal(r.ok, false);
  if (r.ok) throw new Error("expected fail");
  assert.match(r.speak, /Wednesday/);
}

console.log("\nAll resolve-datetime checks passed.");
