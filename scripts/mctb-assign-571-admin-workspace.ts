/**
 * Link the proven platform 571 DID to an admin workspace for production/setup testing
 * WITHOUT changing PhoneNumber.workspaceId (platform demo owner stays intact).
 *
 * Usage:
 *   npx tsx scripts/mctb-assign-571-admin-workspace.ts
 *   npx tsx scripts/mctb-assign-571-admin-workspace.ts --apply
 *   npx tsx scripts/mctb-assign-571-admin-workspace.ts --email <google-account> --apply
 */
import { getPrisma } from "@/lib/db";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  getPlatformDemoPhoneRecord,
  linkWorkspaceToPlatformDemoNumber,
  readAdminTestWorkspaceIds,
} from "@/lib/mctb/platform-demo-access";
import { activateJohnOnPhoneNumber } from "@/lib/agents/missed-call-text-back/phone-switch";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const email = (
  args.includes("--email")
    ? args[args.indexOf("--email") + 1]
    : process.env.MCTB_ADMIN_ASSIGN_EMAIL
)?.trim();
if (!email) {
  console.error("Provide --email <address> or set MCTB_ADMIN_ASSIGN_EMAIL");
  process.exit(1);
}

async function main() {
  const prisma = getPrisma();

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true, name: true, phone: true },
  });
  if (!user) {
    console.error(`❌ No user found for ${email}`);
    process.exit(1);
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, workspace: { type: "BUSINESS" } },
    include: { workspace: { select: { id: true, name: true, billingPlan: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    console.error(`❌ No BUSINESS workspace membership for ${email}`);
    process.exit(1);
  }

  const pn = await getPlatformDemoPhoneRecord();
  if (!pn) {
    console.error(`❌ No PhoneNumber record for ${MCTB_PLATFORM_DEMO_E164}`);
    process.exit(1);
  }

  console.log("\n── 571 admin workspace assignment audit ──\n");
  console.log(`User:              ${user.email} (${user.id})`);
  console.log(`Workspace:         ${membership.workspace.name} (${membership.workspaceId})`);
  console.log(`Billing plan:      ${membership.workspace.billingPlan}`);
  console.log(`PhoneNumber id:    ${pn.phoneNumberId}`);
  console.log(`571 E.164:         ${pn.e164}`);
  console.log(`Owner workspace:   ${pn.ownerWorkspaceId}`);
  console.log(`mctbRole:          ${String(pn.settingsJson.mctbRole || "(unset)")}`);
  console.log(`platformDemo:      ${String(pn.settingsJson.platformDemo ?? false)}`);
  console.log(
    `adminTestWorkspaceIds: ${JSON.stringify(readAdminTestWorkspaceIds(pn.settingsJson))}`,
  );

  const alreadyAuthorized =
    pn.ownerWorkspaceId === membership.workspaceId ||
    readAdminTestWorkspaceIds(pn.settingsJson).includes(membership.workspaceId);

  if (!apply) {
    console.log(
      alreadyAuthorized
        ? "\n✅ Workspace already authorized for 571 production testing (dry-run)"
        : "\n📋 Dry-run — would add workspace to adminTestWorkspaceIds and wire missedCallTextConfig",
    );
    console.log("Re-run with --apply to write.");
    process.exit(0);
  }

  const link = await linkWorkspaceToPlatformDemoNumber({
    workspaceId: membership.workspaceId,
    userEmail: user.email,
  });

  await activateJohnOnPhoneNumber({
    workspaceId: membership.workspaceId,
    phoneNumberId: link.phoneNumberId,
    smsPhoneNumberId: link.phoneNumberId,
    delaySeconds: 0,
  }).catch((err) => {
    console.warn(
      "[assign-571] activateJohnOnPhoneNumber skipped (cross-workspace phone reference):",
      err instanceof Error ? err.message : err,
    );
  });

  const runtime = await prisma.missedCallTextConfig.findUnique({
    where: { workspaceId: membership.workspaceId },
    select: { phoneNumberId: true, smsPhoneNumberId: true, enabled: true },
  });

  console.log("\n✅ Linked admin workspace to platform 571 for setup/production testing");
  console.log(JSON.stringify({ link, runtime }, null, 2));
  console.log(
    "\nPlatform demo ingress unchanged — trial Try It still resolves tenants by caller demo session.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = getPrisma();
    await prisma.$disconnect();
  });
