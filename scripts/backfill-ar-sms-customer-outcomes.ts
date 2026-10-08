/**
 * Backfill ar_sms_outcome_* timeline events for historical Appointment Reminders SMS.
 *
 * Usage:
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/backfill-ar-sms-customer-outcomes.ts
 *   ... --dry-run
 *   ... --workspace-id=ws_xxx
 *   ... --appointment-id=appt_xxx
 *   ... --limit=2000
 */
import { runArSmsCustomerOutcomeBackfill } from "@/lib/appointment-reminders/run-ar-sms-outcome-backfill";

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const workspaceId = readArg("workspace-id");
  const appointmentId = readArg("appointment-id");
  const limit = readArg("limit") ? Number(readArg("limit")) : undefined;

  const result = await runArSmsCustomerOutcomeBackfill({
    workspaceId,
    appointmentId,
    limit,
    dryRun,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun,
        workspaceId: workspaceId ?? null,
        appointmentId: appointmentId ?? null,
        ...result,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
