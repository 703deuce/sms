/**
 * Apply Personal/Business workspace schema backfill on an existing database.
 * Uses Prisma Client + DATABASE_URL (not the Supabase compat runtime layer).
 * Safe to run multiple times.
 *
 * Run: npx tsx scripts/migrate-workspace-types.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runSql(statement: string) {
  const trimmed = statement.trim();
  if (!trimmed) return;
  await prisma.$executeRawUnsafe(trimmed);
}

async function applySchemaIfNeeded() {
  const statements = [
    `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WorkspaceType') THEN
    CREATE TYPE "WorkspaceType" AS ENUM ('PERSONAL', 'BUSINESS');
  END IF;
END$$`,
    `ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "type" "WorkspaceType" NOT NULL DEFAULT 'BUSINESS'`,
    `ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT`,
    `CREATE INDEX IF NOT EXISTS "Workspace_ownerUserId_idx" ON "Workspace" ("ownerUserId")`,
    `CREATE INDEX IF NOT EXISTS "Workspace_type_idx" ON "Workspace" ("type")`,
    `UPDATE "Workspace" SET "type" = 'BUSINESS' WHERE "type" IS NULL`,
  ];

  for (const sql of statements) {
    try {
      await runSql(sql);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // db:push may have already applied schema — continue on benign conflicts.
      if (/already exists|duplicate/i.test(message)) continue;
      throw err;
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  await applySchemaIfNeeded();

  const ownerMemberships = await prisma.membership.findMany({
    where: { role: "OWNER" },
    select: { workspaceId: true, userId: true },
  });

  let ownersSet = 0;
  for (const m of ownerMemberships) {
    const updated = await prisma.workspace.updateMany({
      where: { id: m.workspaceId, ownerUserId: null },
      data: { ownerUserId: m.userId },
    });
    ownersSet += updated.count;
  }

  // Fallback: assign earliest membership when no OWNER row exists (legacy workspaces).
  const fallback = await prisma.$executeRawUnsafe(`
    UPDATE "Workspace" w
    SET "ownerUserId" = sub."userId"
    FROM (
      SELECT DISTINCT ON ("workspaceId") "workspaceId", "userId"
      FROM "Membership"
      ORDER BY "workspaceId",
        CASE "role"
          WHEN 'OWNER' THEN 0
          WHEN 'ADMINISTRATOR' THEN 1
          WHEN 'MANAGER' THEN 2
          ELSE 3
        END,
        "id" ASC
    ) sub
    WHERE w.id = sub."workspaceId" AND w."ownerUserId" IS NULL
  `);
  ownersSet += typeof fallback === "number" ? fallback : 0;

  const [total, business, personal, missingOwner] = await Promise.all([
    prisma.workspace.count(),
    prisma.workspace.count({ where: { type: "BUSINESS" } }),
    prisma.workspace.count({ where: { type: "PERSONAL" } }),
    prisma.workspace.count({ where: { ownerUserId: null } }),
  ]);

  console.log("migrate-workspace-types: ok");
  console.log(
    JSON.stringify({
      workspaces: total,
      business,
      personal,
      ownerUserIdBackfilled: ownersSet,
      workspacesWithoutOwner: missingOwner,
    }),
  );
}

main()
  .catch((err) => {
    console.error("migrate-workspace-types failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
