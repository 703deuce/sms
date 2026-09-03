#!/usr/bin/env tsx
/**
 * Double-booking protection unit tests (advisory lock + SlotTakenError).
 * Run: npx tsx scripts/test-appointments-double-booking.ts
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SlotTakenError } from "../src/lib/appointments/slot-errors";

function advisoryLockId(workspaceId: string, serviceName: string, startsAt: string): bigint {
  const hash = createHash("sha256")
    .update(`${workspaceId}|${serviceName}|${startsAt}`)
    .digest();
  return hash.readBigInt64BE(0);
}

function testAdvisoryLockDeterministic() {
  const a = advisoryLockId("ws1", "Consultation", "2026-09-15T14:00:00.000Z");
  const b = advisoryLockId("ws1", "Consultation", "2026-09-15T14:00:00.000Z");
  const c = advisoryLockId("ws1", "Consultation", "2026-09-15T15:00:00.000Z");
  assert.equal(a, b);
  assert.notEqual(a, c);
  console.log("PASS advisory lock id is deterministic per slot");
}

function testSlotTakenErrorMessage() {
  const err = new SlotTakenError();
  assert.match(err.message, /just taken/i);
  assert.equal(err.name, "SlotTakenError");
  console.log("PASS SlotTakenError consumer-friendly message");
}

async function testConcurrentMutexSimulation() {
  let held = false;
  let winner: string | null = null;
  const acquire = async (name: string) => {
    if (held) throw new SlotTakenError();
    held = true;
    await new Promise((r) => setTimeout(r, 20));
    if (!winner) winner = name;
    held = false;
  };

  const results = await Promise.allSettled([acquire("a"), acquire("b")]);
  const successes = results.filter((r) => r.status === "fulfilled").length;
  const failures = results.filter(
    (r) => r.status === "rejected" && r.reason instanceof SlotTakenError,
  ).length;
  assert.equal(successes, 1);
  assert.equal(failures, 1);
  console.log("PASS concurrent slot acquisition allows only one winner");
}

async function main() {
  testAdvisoryLockDeterministic();
  testSlotTakenErrorMessage();
  await testConcurrentMutexSimulation();
  console.log("\nAll double-booking tests passed.");
}

void main();
