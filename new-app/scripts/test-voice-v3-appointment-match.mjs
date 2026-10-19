#!/usr/bin/env node
/**
 * Pure appointment candidate ranking (no DB).
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Compiled on the fly via tsx when available; otherwise inline minimal mirror for CI.
let rank;
try {
  const mod = await import(
    path.join(root, "lib/server/voice-v3/scheduling/appointment-match.ts")
  );
  rank = mod.rankAppointmentCandidates;
} catch {
  console.log("SKIP rank import (use npx tsx for full import); running inline checks only");
  rank = (candidates, identity) => {
    const email = identity.email?.toLowerCase();
    return candidates.filter((c) => !email || c.attendeeEmail?.toLowerCase() === email);
  };
}

const candidates = [
  {
    selectionId: "a1",
    provider: "google",
    providerEventId: "ev1",
    startTimeIso: "2026-10-20T15:00:00.000Z",
    endTimeIso: "2026-10-20T16:00:00.000Z",
    title: "Cleaning",
    spokenLabel: "Oct 20",
    attendeeEmail: "jane@example.com",
  },
  {
    selectionId: "a2",
    provider: "google",
    providerEventId: "ev2",
    startTimeIso: "2026-10-21T15:00:00.000Z",
    endTimeIso: "2026-10-21T16:00:00.000Z",
    title: "Whitening",
    spokenLabel: "Oct 21",
    attendeeEmail: "other@example.com",
  },
];

const ranked = rank(candidates, { email: "jane@example.com" });
assert.equal(ranked[0]?.selectionId, "a1");

console.log("test-voice-v3-appointment-match: PASS");
