/**
 * Sync workspace PhoneNumber.e164 with Telnyx for the 571 MCTB line.
 * Telnyx provider id cmsgtjms84g6l2h0o255w1e3v maps to +15714073615.
 *
 *   npx tsx scripts/sync-571-e164-from-telnyx.mjs
 */
const PHONE_ID = (process.env.PHONE_ID || "cmsgtjms84g6l2h0o255w1e3v").trim();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { telnyxRequest } = await import("../src/lib/messaging/telnyx/client.ts");
  const prisma = new PrismaClient();
  const row = await prisma.phoneNumber.findUnique({ where: { id: PHONE_ID } });
  if (!row?.providerNumberId) throw new Error(`Phone ${PHONE_ID} not found or missing provider id`);

  const telnyx = await telnyxRequest(`/phone_numbers/${row.providerNumberId}`);
  const telnyxE164 = String(telnyx?.data?.phone_number || telnyx?.phone_number || "").trim();
  if (!telnyxE164.startsWith("+")) throw new Error("Telnyx returned no E164");

  if (row.e164 === telnyxE164) {
    console.log(JSON.stringify({ ok: true, alreadySynced: true, e164: telnyxE164 }, null, 2));
    await prisma.$disconnect();
    return;
  }

  const conflict = await prisma.phoneNumber.findFirst({
    where: { workspaceId: row.workspaceId, e164: telnyxE164 },
  });
  if (conflict && conflict.id !== PHONE_ID) {
    throw new Error(`E164 ${telnyxE164} already used by ${conflict.id}`);
  }

  const updated = await prisma.phoneNumber.update({
    where: { id: PHONE_ID },
    data: { e164: telnyxE164 },
  });
  console.log(
    JSON.stringify(
      { ok: true, previous: row.e164, e164: updated.e164, providerNumberId: row.providerNumberId },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
