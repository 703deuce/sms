/**
 * Purge platform-demo linkage from phone_numbers settings.
 * Run after removing platform demo: npx tsx scripts/purge-platform-demo-db.ts
 */
import { getPrisma } from "../src/lib/db";
import { readAdminTestWorkspaceIds } from "../src/lib/mctb/platform-demo-access-shared";

const STALE_DEMO_ROW_ID = "cmte8laci4o021u5q46723128";

async function main() {
  const prisma = getPrisma();
  const phones = await prisma.phoneNumber.findMany({
    select: { id: true, e164: true, workspaceId: true, settingsJson: true, status: true },
  });

  let updated = 0;
  for (const phone of phones) {
    const settings =
      phone.settingsJson && typeof phone.settingsJson === "object" && !Array.isArray(phone.settingsJson)
        ? { ...(phone.settingsJson as Record<string, unknown>) }
        : null;
    if (!settings) continue;

    const linked = readAdminTestWorkspaceIds(settings);
    const hadDemo =
      settings.platformDemo === true ||
      settings.mctbRole === "platform_demo" ||
      linked.length > 0;

    if (!hadDemo && phone.id !== STALE_DEMO_ROW_ID) continue;

    delete settings.platformDemo;
    delete settings.adminTestWorkspaceIds;
    delete settings.linkedAdminWorkspaces;
    delete settings.lastAdminLinkAt;
    delete settings.lastAdminLinkEmail;
    delete settings.lastUnlinkAt;
    delete settings.lastUnlinkedWorkspaceId;

    if (phone.id === STALE_DEMO_ROW_ID) {
      settings.archivedPlatformDemoRow = true;
      settings.mctbRole = "archived";
      const telephony =
        settings.telephony && typeof settings.telephony === "object"
          ? { ...(settings.telephony as Record<string, unknown>) }
          : {};
      telephony.routingMode = "archived";
      settings.telephony = telephony;
    } else if (settings.mctbRole === "platform_demo") {
      settings.mctbRole = "customer_mctb";
    }

    await prisma.phoneNumber.update({
      where: { id: phone.id },
      data: { settingsJson: settings },
    });
    updated += 1;
    console.log("cleared", phone.id, phone.e164, phone.workspaceId);
  }

  console.log(JSON.stringify({ updated, staleDemoRowId: STALE_DEMO_ROW_ID }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
