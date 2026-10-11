/**
 * Ops: grant Appointment Reminders Business (no Stripe) for internal test workspaces.
 *
 *   WORKSPACE_ID=ws_1 NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/ar-grant-business-plan.ts --apply
 *   --email 703deuce@gmail.com --apply
 */
import { getPrisma } from "@/lib/db";
import { AR_PLATFORM_PRODUCT_FAMILY } from "@/lib/appointment-reminders/ar-sms-usage-constants";
import {
  clearArFreePlanMarker,
  resolveArWorkspaceCommercial,
} from "@/lib/appointment-reminders/commercial/ar-workspace-plan";
import { arPlanDefinition } from "@/lib/appointment-reminders/commercial/ar-plan-catalog";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const tier = (args.includes("--tier")
  ? args[args.indexOf("--tier") + 1]
  : "business") as "starter" | "growth" | "business";

async function resolveWorkspaceId(): Promise<{ workspaceId: string; email?: string }> {
  const prisma = getPrisma();
  const fromEnv = process.env.WORKSPACE_ID?.trim();
  if (fromEnv) {
    const ws = await prisma.workspace.findUnique({
      where: { id: fromEnv },
      select: { id: true },
    });
    if (!ws) throw new Error(`Workspace not found: ${fromEnv}`);
    return { workspaceId: fromEnv };
  }
  const email = (
    args.includes("--email") ? args[args.indexOf("--email") + 1] : process.env.AR_GRANT_EMAIL
  )?.trim();
  if (!email) {
    throw new Error("Set WORKSPACE_ID or --email (or AR_GRANT_EMAIL)");
  }
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${email}`);
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    select: { workspaceId: true },
  });
  if (!membership) throw new Error(`No workspace membership for ${email}`);
  return { workspaceId: membership.workspaceId, email: user.email };
}

async function main() {
  const { workspaceId, email } = await resolveWorkspaceId();
  const before = await resolveArWorkspaceCommercial(workspaceId);
  const plan = arPlanDefinition(tier);

  console.log(
    JSON.stringify(
      {
        workspaceId,
        email,
        apply,
        tier,
        before: {
          planKey: before.planKey,
          stripeStatus: before.stripeStatus,
          hasProductAccess: before.hasProductAccess,
        },
        afterPreview: {
          planKey: tier,
          smsConfirmationsAndResponses: plan.smsConfirmationsAndResponses,
          aiReschedulerModes: plan.aiReschedulerModes,
        },
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log("Dry run — pass --apply to write.");
    return;
  }

  const prisma = getPrisma();
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const stripeSubscriptionId = `admin_grant_ar_${workspaceId}`;

  await clearArFreePlanMarker(workspaceId);

  await prisma.platformProductSubscription.upsert({
    where: {
      workspaceId_productFamily: { workspaceId, productFamily: AR_PLATFORM_PRODUCT_FAMILY },
    },
    create: {
      workspaceId,
      productFamily: AR_PLATFORM_PRODUCT_FAMILY,
      tier,
      stripeSubscriptionId,
      stripePriceId: `admin_grant_ar_${tier}`,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      usagePeriodStart: now,
      usagePeriodEnd: periodEnd,
      metadataJson: { source: "ar-grant-business-plan", grantedAt: now.toISOString() },
    },
    update: {
      tier,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      usagePeriodStart: now,
      usagePeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      metadataJson: { source: "ar-grant-business-plan", grantedAt: now.toISOString() },
    },
  });

  const after = await resolveArWorkspaceCommercial(workspaceId);
  console.log(
    JSON.stringify(
      {
        ok: true,
        workspaceId,
        after: {
          planKey: after.planKey,
          stripeStatus: after.stripeStatus,
          hasProductAccess: after.hasProductAccess,
        },
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
