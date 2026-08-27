/**
 * Full admin MCTB test account setup for platform admin (703 Deuce / ws_1).
 * - Links ws_1 to platform 571 without moving DID ownership
 * - Wires missedCallTextConfig to 571
 * - Sets verified caller phone for Try It (from OUTBOUND_TEST_PHONE)
 * - Marks workspace for unlimited admin MCTB testing
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-setup-admin-test-account.ts --apply
 */
import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { saveMissedCallTextBack } from "@/lib/solutions/missed-call-text-back/save";
import { grantProductEntitlement } from "@/lib/products/entitlements";
import {
  getPlatformDemoPhoneRecord,
  linkWorkspaceToPlatformDemoNumber,
  readAdminTestWorkspaceIds,
} from "@/lib/mctb/platform-demo-access";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const email = (
  args.includes("--email")
    ? args[args.indexOf("--email") + 1]
    : process.env.MCTB_ADMIN_ASSIGN_EMAIL
)?.trim();

async function resolveUserId(prisma: ReturnType<typeof getPrisma>): Promise<string> {
  if (args.includes("--user-id")) return args[args.indexOf("--user-id") + 1]!;
  if (process.env.MCTB_ADMIN_USER_ID?.trim()) return process.env.MCTB_ADMIN_USER_ID.trim();
  if (email) {
    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    });
    if (!user) throw new Error(`User not found for email ${email}`);
    return user.id;
  }
  return "cmsa28nos0000jsp1gmu9kb3y";
}

const workspaceId =
  (args.includes("--workspace-id") ? args[args.indexOf("--workspace-id") + 1] : null) ||
  process.env.MCTB_ADMIN_WORKSPACE_ID ||
  "ws_1";

function callerPhoneFromEnv(): string | null {
  const raw =
    process.env.MCTB_TEST_CALLER_E164?.trim() ||
    process.env.OUTBOUND_TEST_PHONE?.trim() ||
    process.env.VOICE_TRANSFER_FALLBACK_E164?.trim() ||
    null;
  if (!raw) return null;
  try {
    return normalizeE164(raw);
  } catch {
    return null;
  }
}

async function main() {
  const prisma = getPrisma();
  const userId = await resolveUserId(prisma);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, phone: true, phoneVerifiedAt: true, isPlatformAdmin: true },
  });
  if (!user) throw new Error(`User not found: ${userId}`);

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, workspaceId },
    include: { workspace: { select: { id: true, name: true, billingPlan: true, customFieldsConfig: true } } },
  });
  if (!membership) throw new Error(`User ${user.id} is not a member of ${workspaceId}`);

  const pn = await getPlatformDemoPhoneRecord();
  if (!pn) throw new Error("Platform 571 PhoneNumber row not found");

  const callerE164 = callerPhoneFromEnv();
  const limits = await prisma.workspaceLimits.findUnique({ where: { workspaceId } });

  console.log("\n── Admin MCTB test account setup ──\n");
  console.log(`User:           ${user.email} (${user.id}) admin=${user.isPlatformAdmin}`);
  console.log(`Workspace:      ${membership.workspace.name} (${workspaceId}) plan=${membership.workspace.billingPlan}`);
  console.log(`571 phone id:   ${pn.phoneNumberId} ownerWs=${pn.ownerWorkspaceId}`);
  console.log(`adminTestIds:   ${JSON.stringify(readAdminTestWorkspaceIds(pn.settingsJson))}`);
  console.log(`Caller phone:   ${callerE164 || "(set OUTBOUND_TEST_PHONE or MCTB_TEST_CALLER_E164)"}`);
  console.log(`User phone now: ${user.phone || "(none)"}`);

  if (!apply) {
    console.log("\n📋 Dry-run only. Re-run with --apply to write.");
    return;
  }

  const link = await linkWorkspaceToPlatformDemoNumber({
    workspaceId,
    userEmail: user.email,
  });

  await saveMissedCallTextBack(workspaceId, {
    phoneNumberId: link.phoneNumberId,
    initialDelayMinutes: 0,
    initialDelaySeconds: 0,
    firstMessage: "Sorry we missed your call! Reply here and we'll get back to you shortly.",
    followUpEnabled: false,
    activate: true,
    name: "Admin — Missed Call Text Back (571)",
  });

  await updateMissedCallTextConfig({
    workspaceId,
    patch: {
      enabled: true,
      delay_seconds: 0,
      phone_number_id: link.phoneNumberId,
      sms_phone_number_id: link.phoneNumberId,
    },
    source: "admin_test_account_setup",
  });

  if (callerE164) {
    await prisma.user.update({
      where: { id: user.id },
      data: { phone: callerE164, phoneVerifiedAt: user.phoneVerifiedAt || new Date() },
    });
  }

  const cfg =
    membership.workspace.customFieldsConfig && typeof membership.workspace.customFieldsConfig === "object"
      ? (membership.workspace.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      activeFromNumberId: link.phoneNumberId,
      creditBalanceCents: 1_000_000_00,
      customFieldsConfig: {
        ...cfg,
        mctb: {
          ...mctb,
          adminTestAccount: true,
          unlimitedMctbTesting: true,
        },
        billing: {
          ...(cfg.billing && typeof cfg.billing === "object"
            ? (cfg.billing as Record<string, unknown>)
            : {}),
          adminUnlimited: true,
          unlimitedCredits: true,
        },
      },
    },
  });

  const priorLimits =
    limits?.limits && typeof limits.limits === "object"
      ? (limits.limits as Record<string, unknown>)
      : {};

  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: {
        ...priorLimits,
        mctbServiceStatus: "ACTIVE",
        trialSmsSegmentsUsed: 0,
        trialSmsSegmentLimit: null,
        adminUnlimitedMctb: true,
        adminUnlimitedCredits: true,
      },
    },
    update: {
      limits: {
        ...priorLimits,
        mctbServiceStatus: "ACTIVE",
        trialSmsSegmentsUsed: 0,
        trialSmsSegmentLimit: null,
        adminUnlimitedMctb: true,
        adminUnlimitedCredits: true,
      },
    },
  });

  await grantProductEntitlement(workspaceId, "voice", "active");

  const runtime = await prisma.missedCallTextConfig.findUnique({ where: { workspaceId } });
  const refreshedUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true, phoneVerifiedAt: true },
  });
  const refreshedPn = await getPlatformDemoPhoneRecord();

  console.log("\n✅ Admin MCTB test account ready");
  console.log(
    JSON.stringify(
      {
        link,
        runtime: {
          phoneNumberId: runtime?.phoneNumberId,
          enabled: runtime?.enabled,
          delaySeconds: runtime?.delaySeconds,
        },
        userPhone: refreshedUser?.phone,
        adminTestWorkspaceIds: readAdminTestWorkspaceIds(refreshedPn?.settingsJson),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
