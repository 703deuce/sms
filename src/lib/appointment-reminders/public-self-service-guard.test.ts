import assert from "node:assert/strict";
import { assessPublicSelfServiceEligibility } from "./public-self-service-guard";

const now = new Date("2026-10-12T12:00:00.000Z");

assert.deepEqual(
  assessPublicSelfServiceEligibility({
    status: "canceled",
    startsAt: new Date("2026-10-20T12:00:00.000Z"),
    now,
  }),
  { allowed: false, reason: "canceled" },
);

assert.deepEqual(
  assessPublicSelfServiceEligibility({
    status: "scheduled",
    startsAt: new Date("2026-10-08T12:00:00.000Z"),
    endsAt: new Date("2026-10-08T13:00:00.000Z"),
    now,
  }),
  { allowed: false, reason: "past" },
);

assert.deepEqual(
  assessPublicSelfServiceEligibility({
    status: "confirmed",
    startsAt: new Date("2026-10-20T14:00:00.000Z"),
    endsAt: new Date("2026-10-20T15:00:00.000Z"),
    now,
  }),
  { allowed: true },
);

console.log("public-self-service-guard.test.ts: ok");
