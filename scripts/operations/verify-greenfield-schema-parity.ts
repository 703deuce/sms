#!/usr/bin/env npx tsx
/**
 * Read-only: compare public schema (tables + columns) between legacy and greenfield Postgres.
 * See docs/NEW-APP-DATABASE-GREENFIELD.md
 */
import { PrismaClient } from "@prisma/client";

const legacyUrl = process.env.LEGACY_DATABASE_URL?.trim();
const greenUrl =
  process.env.GREENFIELD_DATABASE_URL?.trim() ||
  process.env.DATABASE_URL?.trim();

if (!legacyUrl || !greenUrl) {
  console.error(
    "[parity] Set LEGACY_DATABASE_URL and GREENFIELD_DATABASE_URL (or GREENFIELD + LEGACY only).",
  );
  process.exit(1);
}

if (legacyUrl === greenUrl) {
  console.error("[parity] Legacy and greenfield URLs must differ.");
  process.exit(1);
}

type ColumnRow = { table_name: string; column_name: string; data_type: string };

async function loadColumns(url: string, label: string): Promise<Map<string, Set<string>>> {
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });
  try {
    const rows = await prisma.$queryRaw<ColumnRow[]>`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;
    const byTable = new Map<string, Set<string>>();
    for (const row of rows) {
      let set = byTable.get(row.table_name);
      if (!set) {
        set = new Set();
        byTable.set(row.table_name, set);
      }
      set.add(`${row.column_name}:${row.data_type}`);
    }
    console.log(`[parity] ${label}: ${byTable.size} tables, ${rows.length} columns`);
    return byTable;
  } finally {
    await prisma.$disconnect();
  }
}

async function migrationCount(url: string, label: string): Promise<number> {
  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations"
    `;
    const n = Number(rows[0]?.count ?? 0);
    console.log(`[parity] ${label}: ${n} applied migrations`);
    return n;
  } catch {
    console.log(`[parity] ${label}: _prisma_migrations missing or unreadable`);
    return -1;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const [legacyCols, greenCols] = await Promise.all([
    loadColumns(legacyUrl, "legacy"),
    loadColumns(greenUrl, "greenfield"),
  ]);

  const legacyTables = new Set(legacyCols.keys());
  const greenTables = new Set(greenCols.keys());

  const onlyLegacy = [...legacyTables].filter((t) => !greenTables.has(t)).sort();
  const onlyGreen = [...greenTables].filter((t) => !legacyTables.has(t)).sort();

  const columnMismatches: string[] = [];
  for (const table of [...legacyTables].filter((t) => greenTables.has(t)).sort()) {
    const a = legacyCols.get(table)!;
    const b = greenCols.get(table)!;
    const onlyA = [...a].filter((c) => !b.has(c));
    const onlyB = [...b].filter((c) => !a.has(c));
    if (onlyA.length || onlyB.length) {
      columnMismatches.push(
        `${table}: legacy-only [${onlyA.join(", ")}] greenfield-only [${onlyB.join(", ")}]`,
      );
    }
  }

  const [legacyMig, greenMig] = await Promise.all([
    migrationCount(legacyUrl, "legacy"),
    migrationCount(greenUrl, "greenfield"),
  ]);

  let failed = false;
  if (onlyLegacy.length) {
    failed = true;
    console.error("[parity] FAIL tables only on legacy:", onlyLegacy.join(", "));
  }
  if (onlyGreen.length) {
    failed = true;
    console.error("[parity] FAIL tables only on greenfield:", onlyGreen.join(", "));
  }
  if (columnMismatches.length) {
    failed = true;
    console.error("[parity] FAIL column mismatches:");
    for (const line of columnMismatches.slice(0, 30)) {
      console.error(`  ${line}`);
    }
    if (columnMismatches.length > 30) {
      console.error(`  ... and ${columnMismatches.length - 30} more`);
    }
  }
  if (legacyMig >= 0 && greenMig >= 0 && legacyMig !== greenMig) {
    failed = true;
    console.error(
      `[parity] FAIL migration count legacy=${legacyMig} greenfield=${greenMig} (deploy latest to the lagging side)`,
    );
  }

  if (failed) {
    process.exit(1);
  }
  console.log("[parity] PASS — public table/column definitions match.");
}

main().catch((err) => {
  console.error("[parity] ERROR", err);
  process.exit(1);
});
