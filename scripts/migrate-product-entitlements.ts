/**
 * Backfill ProductEntitlement rows from existing workspace types.
 * Run: npx tsx scripts/migrate-product-entitlements.ts
 */
import { getPrisma } from "@/lib/db";
import { ensureWorkspaceEntitlements } from "@/lib/products/entitlements";

async function main() {
  const prisma = getPrisma();
  const workspaces = await prisma.workspace.findMany({ select: { id: true, type: true } });
  let count = 0;
  for (const ws of workspaces) {
    await ensureWorkspaceEntitlements(ws.id);
    count += 1;
  }
  console.log(`Ensured product entitlements for ${count} workspace(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
