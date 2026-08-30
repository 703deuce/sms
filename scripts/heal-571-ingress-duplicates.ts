/**
 * Release stale duplicate +15714073615 rows and assert ws_1 owns ingress.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/heal-571-ingress-duplicates.ts --apply
 */
import { getPrisma } from "@/lib/db";
import { resolveBestMctbIngressPhoneRow } from "@/lib/mctb/texml-ingress/resolve-phone-row";
import { invalidateMctbTexmlIngressCache } from "@/lib/mctb/texml-ingress/config-cache";

const E164 = "+15714073615";
const WS_1_OWNED = "cmsgtjms84g6l2h0o255w1e3v";
const STALE_ROWS = [
  "cmte8laci4o021u5q46723128",
  "cmteeya706h3p194s67052p4m",
];

const apply = process.argv.includes("--apply");

async function main() {
  const prisma = getPrisma();
  const duplicates = await prisma.phoneNumber.findMany({
    where: { e164: E164 },
    select: { id: true, workspaceId: true, status: true, providerNumberId: true },
  });
  console.log("571 rows:", duplicates);

  if (apply) {
    for (const id of STALE_ROWS) {
      const row = duplicates.find((d) => d.id === id);
      if (!row) continue;
      await prisma.phoneNumber.update({
        where: { id },
        data: { status: "Released" },
      });
      console.log("released", id, row.workspaceId);
    }
    invalidateMctbTexmlIngressCache(E164);
  }

  const chosen = await resolveBestMctbIngressPhoneRow(E164);
  console.log("ingress resolves to:", chosen?.id, chosen?.workspaceId);
  if (chosen?.id !== WS_1_OWNED) {
    console.error("❌ Expected ws_1 owned row", WS_1_OWNED);
    process.exit(1);
  }
  console.log(apply ? "✅ Applied and verified" : "✅ Dry-run verified (use --apply to release stale rows)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
