/**
 * One-time: keep only platform workspace ws_1, release duplicate DIDs, delete cert workspaces.
 *
 * Dry-run (default):
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/consolidate-workspaces-to-ws1-only.ts
 *
 * Apply (destructive):
 *   CONFIRM_WS1_ONLY=1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/consolidate-workspaces-to-ws1-only.ts --apply
 */
import { getPrisma } from "@/lib/db";
import { resolveMctbPlatformOwnerWorkspaceId } from "@/lib/mctb/platform-owner-workspace";
import { resolveBestMctbIngressPhoneRow } from "@/lib/mctb/texml-ingress/resolve-phone-row";
import { invalidateMctbTexmlIngressCache } from "@/lib/mctb/texml-ingress/config-cache";

const apply = process.argv.includes("--apply");
const OWNER_WS = resolveMctbPlatformOwnerWorkspaceId();

async function main() {
  if (apply && process.env.CONFIRM_WS1_ONLY !== "1") {
    console.error("Set CONFIRM_WS1_ONLY=1 to apply.");
    process.exit(1);
  }

  const prisma = getPrisma();
  const owner = await prisma.workspace.findUnique({ where: { id: OWNER_WS } });
  if (!owner) {
    console.error(`Missing canonical workspace ${OWNER_WS}`);
    process.exit(1);
  }

  const allWs = await prisma.workspace.findMany({
    select: { id: true, slug: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const toDelete = allWs.filter((w) => w.id !== OWNER_WS);
  console.log(`Workspaces: ${allWs.length} total, ${toDelete.length} to delete (keep ${OWNER_WS})`);

  const e164Groups = await prisma.phoneNumber.groupBy({
    by: ["e164"],
    where: { e164: { not: "" }, status: { not: "Released" } },
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  const releaseIds: string[] = [];
  for (const g of e164Groups) {
    const e164 = g.e164;
    const rows = await prisma.phoneNumber.findMany({
      where: { e164, status: { not: "Released" } },
      select: { id: true, workspaceId: true, providerNumberId: true },
    });
    const ownerRow = rows.find((r) => r.workspaceId === OWNER_WS);
    const chosen =
      ownerRow ||
      (await resolveBestMctbIngressPhoneRow(e164)) ||
      rows.find((r) => r.providerNumberId) ||
      rows[0];
    if (!chosen) continue;
    for (const row of rows) {
      if (row.id !== chosen.id) releaseIds.push(row.id);
    }
    console.log(`E.164 ${e164}: keep ${chosen.id} (${chosen.workspaceId}), release ${rows.length - 1} duplicates`);
  }

  if (apply) {
    for (const id of releaseIds) {
      await prisma.phoneNumber.update({
        where: { id },
        data: { status: "Released", releasedAt: new Date() },
      });
    }
    for (const e164 of e164Groups.map((g) => g.e164)) {
      invalidateMctbTexmlIngressCache(e164);
    }

    const reassigned = await prisma.voiceCall.updateMany({
      where: { workspaceId: { in: toDelete.map((w) => w.id) } },
      data: { workspaceId: OWNER_WS },
    });
    console.log(`Reassigned ${reassigned.count} voice calls to ${OWNER_WS}`);

    for (const w of toDelete) {
      try {
        await prisma.workspace.delete({ where: { id: w.id } });
        console.log("deleted workspace", w.id, w.slug);
      } catch (err) {
        console.error("failed to delete workspace (retry after releasing phones)", w.id, w.slug, err);
        await prisma.phoneNumber.updateMany({
          where: { workspaceId: w.id },
          data: { status: "Released", releasedAt: new Date() },
        });
        await prisma.workspace.delete({ where: { id: w.id } });
        console.log("deleted workspace on retry", w.id, w.slug);
      }
    }
  } else {
    console.log("Would release phone row ids:", releaseIds.length);
    for (const w of toDelete) console.log("  would delete:", w.id, w.slug, w.name);
  }

  const post = await prisma.workspace.count();
  const chosen571 = await resolveBestMctbIngressPhoneRow("+15714073615");
  console.log("After:", { workspaceCount: post, ingress571: chosen571?.workspaceId, apply });
  if (chosen571?.workspaceId !== OWNER_WS) {
    console.error(`571 ingress must resolve to ${OWNER_WS}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
