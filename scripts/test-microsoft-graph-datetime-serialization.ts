#!/usr/bin/env npx tsx
/**
 * Controlled serialization check: Sep 15 4:00 PM America/Los_Angeles → Graph dateTimeTimeZone.
 */
import assert from "node:assert/strict";
import { toMicrosoftDateTimeTimeZone } from "../src/lib/microsoft/graph-datetime-timezone";

const instant = new Date("2026-09-15T23:00:00.000Z");
const end = new Date("2026-09-16T00:00:00.000Z");

const start = toMicrosoftDateTimeTimeZone(instant, "America/Los_Angeles");
const endTz = toMicrosoftDateTimeTimeZone(end, "America/Los_Angeles");

assert.equal(start.dateTime, "2026-09-15T16:00:00");
assert.equal(start.timeZone, "Pacific Standard Time");
assert.equal(endTz.dateTime, "2026-09-15T17:00:00");
assert.equal(endTz.timeZone, "Pacific Standard Time");

const utc = toMicrosoftDateTimeTimeZone(instant, "UTC");
assert.equal(utc.dateTime, "2026-09-15T23:00:00");
assert.equal(utc.timeZone, "UTC");

console.log("test-microsoft-graph-datetime-serialization: PASS", { start, end: endTz, utc });
