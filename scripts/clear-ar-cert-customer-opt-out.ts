/**
 * Remove STOP / opt-out suppression for AR live cert customer (default +15714073615).
 * Restores ws_1 contact to SUBSCRIBED. Safe to run before live SMS cert.
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/clear-ar-cert-customer-opt-out.ts
 */
import { requireIsolatedArTestDatabase } from "./cloud-agent/ar-test-database-guard";
import { getPrisma } from "@/lib/db";

const WORKSPACE_ID = process.env.WORKSPACE_ID?.trim() || "ws_1";
const CUSTOMER_E164 = process.env.AR_LIVE_CUSTOMER_E164?.trim() || "+15714073615";

async function main() {
  requireIsolatedArTestDatabase();
  const prisma = getPrisma();
  const { mctbCallerE164Variants, normalizeMctbCallerE164 } = await import(
    "@/lib/mctb/messaging/caller-e164"
  );
  const phoneVariants = mctbCallerE164Variants(CUSTOMER_E164);
  const normalized = normalizeMctbCallerE164(CUSTOMER_E164);

  const before = await prisma.suppression.findMany({
    where: {
      OR: [
        { phone: { in: phoneVariants } },
        { suppressionKey: { contains: normalized } },
        ...phoneVariants.map((p) => ({ suppressionKey: { contains: p } })),
      ],
    },
    select: { id: true, workspaceId: true, reason: true, source: true },
  });

  const removed = await prisma.suppression.deleteMany({
    where: {
      OR: [
        { phone: { in: phoneVariants } },
        { suppressionKey: { contains: normalized } },
        ...phoneVariants.map((p) => ({ suppressionKey: { contains: p } })),
      ],
    },
  });

  const contact = await prisma.contact.findFirst({
    where: { workspaceId: WORKSPACE_ID, phone: { in: phoneVariants } },
    select: { id: true, status: true },
  });
  if (contact && (contact.status === "UNSUBSCRIBED" || contact.status === "BLOCKED")) {
    await prisma.contact.update({
      where: { id: contact.id },
      data: { status: "SUBSCRIBED", consentSource: "manual" },
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        customer: CUSTOMER_E164,
        workspaceId: WORKSPACE_ID,
        suppressionRowsBefore: before.length,
        suppressionDeleted: removed.count,
        contactStatus: contact?.status ?? "no_contact",
        contactResubscribed:
          contact?.status === "UNSUBSCRIBED" || contact?.status === "BLOCKED",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
