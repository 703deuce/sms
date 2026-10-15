/**
 * AR rescheduler / backfill recency semantics (updatedAt vs startsAt).
 *
 *   npx tsx scripts/test-ar-rescheduler-recency-semantics.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  rowMatchesAiReschedulerOperationsWhere,
  rowHasReconcilePending,
} from "../src/lib/appointment-reminders/ai-rescheduler/operations-query";

const root = join(import.meta.dirname, "..");
const since = new Date("2026-10-01T00:00:00.000Z");

function d(iso: string) {
  return new Date(iso);
}

// 1) Future appointment rescheduled today — must appear via updatedAt even if startsAt is far out.
assert.equal(
  rowMatchesAiReschedulerOperationsWhere(
    {
      updatedAt: d("2026-10-15T12:00:00.000Z"),
      metadata: {
        arRescheduleRequest: { status: "pending_approval", requestedAt: "2026-10-15T12:00:00.000Z" },
      },
    },
    since,
  ),
  true,
  "future appointment with recent modification",
);

// 2) Past startsAt but updated today — must not rely on startsAt window.
assert.equal(
  rowMatchesAiReschedulerOperationsWhere(
    {
      updatedAt: d("2026-10-15T08:00:00.000Z"),
      metadata: { arRescheduleRequest: { status: "processing" } },
    },
    since,
  ),
  true,
  "past startsAt with recent updatedAt",
);

// 3) Pending reconcile on old row (stale updatedAt) — must still match via metadata.
assert.equal(
  rowMatchesAiReschedulerOperationsWhere(
    {
      updatedAt: d("2026-08-01T00:00:00.000Z"),
      metadata: { arReconcilePending: { operationId: "op-1", proposedStartsAt: "2026-12-10T15:00:00.000Z" } },
    },
    since,
  ),
  true,
  "reconcile pending outside updatedAt lookback",
);
assert.equal(
  rowHasReconcilePending({
    arReconcilePending: { operationId: "op-1" },
  } as Parameters<typeof rowHasReconcilePending>[0]),
  true,
);

// 4) SMS backfill: metadata-driven OR must not require startsAt in lookback (ordering only).
const backfillSrc = readFileSync(
  join(root, "src/lib/appointment-reminders/run-ar-sms-outcome-backfill.ts"),
  "utf8",
);
assert.ok(
  backfillSrc.includes("arRescheduleRequest"),
  "backfill selects by metadata signals",
);
assert.ok(
  backfillSrc.includes("voiceAppointmentModificationRecencyOrder"),
  "backfill orders by row modification time",
);
assert.equal(
  /startsAt:\s*\{\s*gte:/.test(backfillSrc),
  false,
  "backfill must not filter by startsAt window",
);

// 5) Operations route must not use startsAt-only window.
const opsRoute = readFileSync(
  join(root, "src/app/api/appointment-reminders/ai-rescheduler/operations/route.ts"),
  "utf8",
);
assert.ok(opsRoute.includes("buildAiReschedulerOperationsWhere"));
assert.equal(/startsAt:\s*\{\s*gte:/.test(opsRoute), false, "operations route must not filter startsAt gte");

const reconcileSrc = readFileSync(
  join(root, "src/lib/appointment-reminders/ai-rescheduler/reconcile-pending.ts"),
  "utf8",
);
assert.ok(reconcileSrc.includes("buildReconcilePendingScanWhere"));
assert.equal(
  /startsAt:\s*\{\s*gte:/.test(reconcileSrc),
  false,
  "reconcile scan must not filter startsAt gte",
);

const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
assert.ok(schema.includes("updatedAt   DateTime   @updatedAt"), "VoiceAppointment.updatedAt in schema");

console.log("test-ar-rescheduler-recency-semantics: ok");
