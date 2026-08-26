/**
 * Backfill Conversation.productSource for existing rows.
 * Run: npx tsx scripts/backfill-mass-texting-conversations.ts
 */
import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();

  const mctbPhones = await prisma.phoneNumber.findMany({
    where: { status: "Active" },
    select: { id: true, workspaceId: true, e164: true, settingsJson: true },
  });

  const mctbPhoneIds = new Set<string>();
  for (const p of mctbPhones) {
    const s =
      p.settingsJson && typeof p.settingsJson === "object"
        ? (p.settingsJson as Record<string, unknown>)
        : {};
    const role = String(s.mctbRole || "").toLowerCase();
    if (role && role !== "none") mctbPhoneIds.add(p.id);
  }

  const recoveryContacts = await prisma.contact.findMany({
    where: { consentSource: "mctb_recovery" },
    select: { id: true, workspaceId: true },
  });
  const recoveryContactIds = new Set(recoveryContacts.map((c) => c.id));

  let mctbTagged = 0;
  let manualTagged = 0;

  const openConversations = await prisma.conversation.findMany({
    where: { productSource: null },
    select: {
      id: true,
      contactId: true,
      workspaceId: true,
      phoneNumberId: true,
      campaignId: true,
    },
    take: 5000,
  });

  for (const c of openConversations) {
    let source: "MCTB" | "MASS_TEXT" | "MANUAL" = "MANUAL";
    if (recoveryContactIds.has(c.contactId)) source = "MCTB";
    else if (c.phoneNumberId && mctbPhoneIds.has(c.phoneNumberId)) source = "MCTB";
    else if (c.campaignId) source = "MASS_TEXT";

    await prisma.conversation.update({
      where: { id: c.id },
      data: { productSource: source },
    });
    if (source === "MCTB") mctbTagged += 1;
    else manualTagged += 1;
  }

  console.log(
    JSON.stringify({
      scanned: openConversations.length,
      mctbTagged,
      manualTagged,
      massTextFromCampaign: openConversations.filter((c) => c.campaignId).length,
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
