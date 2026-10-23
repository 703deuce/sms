/**
 * Read-only prod/staging verification for Phase 4 migration completeness.
 * Run: cd new-app && npx tsx scripts/verify-power-dialer-phase4-migration-readonly.ts
 */
import { PrismaClient } from "@prisma/client";

const PHASE4 = "20261023150000_power_dialer_phase4";
const PHASE6 = "20261023180000_power_dialer_phase6";
const PHASE3 = "20261023140000_power_dialer_lists_phase3";

async function main() {
  const prisma = new PrismaClient();
  try {
    const migrations = await prisma.$queryRaw<
      { migration_name: string; finished_at: Date | null; rolled_back_at: Date | null; checksum: string }[]
    >`SELECT migration_name, finished_at, rolled_back_at, checksum FROM _prisma_migrations WHERE migration_name IN (${PHASE3}, ${PHASE4}, ${PHASE6}) ORDER BY migration_name`;

    const phase6Finished = migrations.some(
      (m) => m.migration_name === PHASE6 && m.finished_at && !m.rolled_back_at,
    );

    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'power_dialer%'
      ORDER BY table_name`;

    const filtersCol = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ContactList' AND column_name = 'filtersJson'`;

    const attemptCols = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'power_dialer_attempts' AND column_name IN ('dispositionId', 'voicemailDropSentAt')`;

    const callbackCount = await prisma.powerDialerCallback.count();
    const attemptsWithCallbackAt = await prisma.powerDialerAttempt.count({
      where: { callbackAt: { not: null } },
    });
    const callbacksWithAttempt = await prisma.powerDialerCallback.count({
      where: { attemptId: { not: null } },
    });

    const setCount = await prisma.powerDialerDispositionSet.count();
    const dispoCount = await prisma.powerDialerDisposition.count();
    const defaultSet = await prisma.powerDialerDispositionSet.findFirst({
      where: { isDefault: true },
      include: { dispositions: { orderBy: { sortOrder: "asc" } } },
    });

    const phase4Finished = migrations.some(
      (m) => m.migration_name === PHASE4 && m.finished_at && !m.rolled_back_at,
    );

    const report = {
      migrations: migrations.map((m) => ({
        name: m.migration_name,
        finished: Boolean(m.finished_at),
        rolledBack: Boolean(m.rolled_back_at),
        checksumPrefix: m.checksum?.slice(0, 12),
      })),
      phase4Applied: phase4Finished,
      phase6Applied: phase6Finished,
      tables: tables.map((t) => t.table_name),
      contactListFiltersJson: filtersCol.length > 0,
      attemptPhase4Columns: attemptCols.map((c) => c.column_name),
      callbacks: {
        total: callbackCount,
        attemptsWithLegacyCallbackAt: attemptsWithCallbackAt,
        withAttemptId: callbacksWithAttempt,
        backfillCoverage:
          attemptsWithCallbackAt === 0
            ? "n/a"
            : `${callbacksWithAttempt}/${attemptsWithCallbackAt}`,
      },
      dispositions: {
        sets: setCount,
        rows: dispoCount,
        defaultLabels: defaultSet?.dispositions.map((d) => d.label) ?? [],
      },
      futureDeploySafe: phase4Finished && phase6Finished,
      dispositionSeedNote:
        setCount === 0
          ? "No disposition rows yet — default set is created on first API access (ensureDefaultDispositionSet)"
          : "ok",
    };

    console.log(JSON.stringify(report, null, 2));
    if (!report.futureDeploySafe) {
      console.error("FAIL: Phase 4 migration not in finished state");
      process.exit(1);
    }
    const requiredTables = [
      "power_dialer_callbacks",
      "power_dialer_disposition_sets",
      "power_dialer_dispositions",
      "power_dialer_scripts",
      "power_dialer_voicemail_drops",
      "power_dialer_internal_dnc",
      "power_dialer_compliance_audit_logs",
      "power_dialer_integration_sync_logs",
    ];
    for (const t of requiredTables) {
      if (!report.tables.includes(t)) {
        console.error(`FAIL: missing table ${t}`);
        process.exit(1);
      }
    }
    console.log("verify-power-dialer-phase4-migration-readonly: PASS");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
