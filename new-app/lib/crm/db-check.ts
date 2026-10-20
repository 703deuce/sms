/**
 * CRM schema validation — confirm tables/indexes exist after migrations.
 */

import { getPrisma } from "@/lib/server/db";

export type DbCheckItem = {
  table: string;
  ok: boolean;
  message: string;
};

export type DbCheckResult = {
  ok: boolean;
  items: DbCheckItem[];
};

const TABLES = [
  "integration_connections",
  "crm_object_mappings",
  "crm_field_mappings",
  "crm_sync_runs",
  "crm_sync_events",
  "crm_audit_logs",
  "crm_webhook_events",
  "crm_dead_letters",
] as const;

export async function checkCrmDatabase(): Promise<DbCheckResult> {
  const prisma = getPrisma();
  const items: DbCheckItem[] = [];

  for (const table of TABLES) {
    try {
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
      items.push({ table, ok: true, message: "Table exists and is queryable" });
    } catch (err) {
      items.push({
        table,
        ok: false,
        message:
          err instanceof Error
            ? err.message.slice(0, 200)
            : "Table missing — run npm run db:push",
      });
    }
  }

  // Spot-check critical columns on integration_connections
  try {
    await prisma.$queryRawUnsafe(
      `SELECT "syncStatus", "connectedUserId", "connectedAccountName", "lastFailedSyncAt", "lastError" FROM "integration_connections" LIMIT 1`,
    );
    items.push({
      table: "integration_connections.columns",
      ok: true,
      message: "CRM connection columns present",
    });
  } catch (err) {
    items.push({
      table: "integration_connections.columns",
      ok: false,
      message:
        err instanceof Error
          ? `Missing CRM columns — run db:push (${err.message.slice(0, 120)})`
          : "Missing CRM columns — run npm run db:push",
    });
  }

  return { ok: items.every((i) => i.ok), items };
}
