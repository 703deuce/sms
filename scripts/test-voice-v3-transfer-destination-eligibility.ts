#!/usr/bin/env npx tsx
import assert from "node:assert/strict";
import {
  evaluateTransferDestinationEligibility,
  normalizeDestinationAvailability,
} from "../src/lib/voice-v3/transfer/evaluate-destination-eligibility";
import type { TransferDestinationAvailability } from "../src/lib/voice-v3/transfer/destination-availability-types";

const TZ = "America/New_York";

function sched(partial: Partial<TransferDestinationAvailability>): TransferDestinationAvailability {
  return normalizeDestinationAvailability(
    {
      mode: "SCHEDULED",
      timezone: TZ,
      temporarilyUnavailable: false,
      weekly: {
        monday: { enabled: true, windows: [{ start: "17:00", end: "07:00" }] },
      },
      ...partial,
    },
    TZ,
  );
}

function at(iso: string): Date {
  return new Date(iso);
}

// Monday 2026-03-02 is a Monday in EST
assert.equal(
  evaluateTransferDestinationEligibility({
    availability: sched({}),
    enabled: true,
    now: at("2026-03-02T22:00:00-05:00"),
    businessTimezone: TZ,
  }).eligible,
  true,
  "Monday 10 PM in overnight window",
);

assert.equal(
  evaluateTransferDestinationEligibility({
    availability: sched({}),
    enabled: true,
    now: at("2026-03-02T16:59:00-05:00"),
    businessTimezone: TZ,
  }).eligible,
  false,
  "Monday 4:59 PM before window",
);

assert.equal(
  evaluateTransferDestinationEligibility({
    availability: sched({}),
    enabled: true,
    now: at("2026-03-03T06:30:00-05:00"),
    businessTimezone: TZ,
  }).eligible,
  true,
  "Tuesday 6:30 AM still in Monday overnight",
);

assert.equal(
  evaluateTransferDestinationEligibility({
    availability: sched({}),
    enabled: true,
    now: at("2026-03-03T07:00:00-05:00"),
    businessTimezone: TZ,
  }).eligible,
  false,
  "Tuesday 7 AM end exclusive",
);

assert.equal(
  evaluateTransferDestinationEligibility({
    availability: normalizeDestinationAvailability(
      { mode: "ALWAYS", timezone: TZ, weekly: {} },
      TZ,
    ),
    enabled: true,
    businessTimezone: TZ,
  }).reason,
  "ALWAYS_AVAILABLE",
);

assert.equal(
  evaluateTransferDestinationEligibility({
    availability: sched({ temporarilyUnavailable: true }),
    enabled: true,
    businessTimezone: TZ,
  }).reason,
  "TEMPORARILY_UNAVAILABLE",
);

// DST spring forward — local 5 PM still eligible (wall clock)
const dstAvail = normalizeDestinationAvailability(
  {
    mode: "SCHEDULED",
    timezone: TZ,
    weekly: {
      sunday: { enabled: true, windows: [{ start: "22:00", end: "06:00" }] },
    },
  },
  TZ,
);
assert.equal(
  evaluateTransferDestinationEligibility({
    availability: dstAvail,
    enabled: true,
    now: at("2026-03-09T02:30:00-04:00"),
    businessTimezone: TZ,
  }).eligible,
  true,
  "Sunday overnight into Monday 2:30 AM EDT",
);

console.log("test-voice-v3-transfer-destination-eligibility: PASS");
