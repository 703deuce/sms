/**
 * Backfill durable AR (customer, platform sender) → workspace from reply sessions with outbound proof.
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/backfill-ar-consumer-sender-assignments.ts [--apply]
 */
import { getPrisma } from "../src/lib/db";
import { ensureArConsumerPlatformSenderAssignment } from "../src/lib/appointment-reminders/messaging/ar-consumer-platform-sender-assignment";

const apply = process.argv.includes("--apply");

async function main() {
  const prisma = getPrisma();
  const rows = await prisma.arSmsReplySession.findMany({
    where: {
      OR: [
        { lastOutboundProviderMessageId: { not: null } },
        { lastOutboundMessageId: { not: null } },
      ],
    },
    select: {
      workspaceId: true,
      consumerE164: true,
      platformPhoneNumberId: true,
      provider: true,
    },
    distinct: ["workspaceId", "consumerE164", "platformPhoneNumberId"],
  });

  console.log(`Found ${rows.length} distinct (workspace, consumer, sender) session groups`);
  if (!apply) {
    console.log("Dry run — pass --apply to write ar_sms_consumer_platform_sender_assignments");
    return;
  }

  let ok = 0;
  let skipped = 0;
  for (const row of rows) {
    try {
      await ensureArConsumerPlatformSenderAssignment({
        workspaceId: row.workspaceId,
        consumerE164: row.consumerE164,
        platformPhoneNumberId: row.platformPhoneNumberId,
        provider: row.provider || "telnyx",
      });
      ok += 1;
    } catch {
      skipped += 1;
    }
  }
  console.log(`Backfill complete: ${ok} upserted, ${skipped} skipped (conflict)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
