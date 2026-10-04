/**
 * Ops: grant one workspace the full MCTB AI Recovery commercial stack (no Stripe).
 *
 *   WORKSPACE_ID=... NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/mctb-grant-full-ai-recovery-plan.ts --apply
 *   --email user@example.com --apply
 */
import { randomUUID } from "node:crypto";
import { getPrisma } from "@/lib/db";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import {
  grantMctbAiRecoveryCommercialEntitlement,
  grantMctbOwnSenderAddOnEntitlement,
} from "@/lib/mctb/commercial-entitlement-grants";
import { saveLeadRecoveryConfig } from "@/lib/mctb/lead-recovery/config";
import { resolveMctbCapabilities } from "@/lib/mctb/capabilities";
import { resolveMctbCommercialEntitlements } from "@/lib/mctb/commercial-entitlements";
import { currentMctbRecoveryPeriodKey } from "@/lib/mctb/recovery-usage-constants";

const args = process.argv.slice(2);
const apply = args.includes("--apply");

async function resolveWorkspaceId(prisma: ReturnType<typeof getPrisma>): Promise<string> {
  const fromEnv = process.env.WORKSPACE_ID?.trim();
  if (fromEnv) return fromEnv;
  if (args.includes("--workspace-id")) {
    return args[args.indexOf("--workspace-id") + 1]!;
  }
  const email = (
    args.includes("--email") ? args[args.indexOf("--email") + 1] : process.env.MCTB_GRANT_EMAIL
  )?.trim();
  if (!email) {
    throw new Error("Set WORKSPACE_ID or --email");
  }
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  if (!user) throw new Error(`User not found: ${email}`);
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { workspaceId: true },
  });
  if (!membership) throw new Error(`No workspace for ${email}`);
  return membership.workspaceId;
}

async function upsertAdminSubscription(
  workspaceId: string,
  productFamily: string,
  tier: string,
): Promise<void> {
  const prisma = getPrisma();
  const stripeSubscriptionId = `admin_grant_${workspaceId}_${productFamily}`;
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  await prisma.platformProductSubscription.upsert({
    where: {
      workspaceId_productFamily: { workspaceId, productFamily },
    },
    create: {
      workspaceId,
      productFamily,
      tier,
      stripeSubscriptionId,
      stripePriceId: `admin_grant_${tier}`,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      usagePeriodStart: now,
      usagePeriodEnd: periodEnd,
      metadataJson: { source: "mctb-grant-full-ai-recovery-plan" },
    },
    update: {
      tier,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      usagePeriodStart: now,
      usagePeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      metadataJson: { source: "mctb-grant-full-ai-recovery-plan", updatedAt: now.toISOString() },
    },
  });
}

async function main() {
  const prisma = getPrisma();
  const workspaceId = await resolveWorkspaceId(prisma);
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, billingPlan: true, customFieldsConfig: true },
  });
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);

  const beforeCommercial = await resolveMctbCommercialEntitlements(workspaceId);
  const beforeCaps = await resolveMctbCapabilities(workspaceId);

  console.log("\n── MCTB full AI Recovery grant ──\n");
  console.log(`Workspace: ${ws.name} (${workspaceId}) billingPlan=${ws.billingPlan}`);
  console.log("Before:", JSON.stringify({ commercial: beforeCommercial, caps: beforeCaps }, null, 2));

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
    return;
  }

  await upsertAdminSubscription(workspaceId, "mctb", "pro");
  await upsertAdminSubscription(workspaceId, "mctb_ai_recovery", "default");

  await grantWorkspaceProductFeature(workspaceId, "mctb", "active");
  await grantMctbAiRecoveryCommercialEntitlement(workspaceId);
  await grantMctbOwnSenderAddOnEntitlement(workspaceId);

  const cfg =
    ws.customFieldsConfig && typeof ws.customFieldsConfig === "object"
      ? (ws.customFieldsConfig as Record<string, unknown>)
      : {};
  const mctb =
    cfg.mctb && typeof cfg.mctb === "object" ? (cfg.mctb as Record<string, unknown>) : {};

  const limitsRow = await prisma.workspaceLimits.findUnique({ where: { workspaceId } });
  const priorLimits =
    limitsRow?.limits && typeof limitsRow.limits === "object"
      ? (limitsRow.limits as Record<string, unknown>)
      : {};

  const periodKey = currentMctbRecoveryPeriodKey();

  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: {
        ...priorLimits,
        mctbServiceStatus: "ACTIVE",
        adminUnlimitedMctb: true,
        mctbRecoveriesPeriodKey: periodKey,
        mctbRecoveriesUsed: 0,
        trialSmsSegmentLimit: null,
      },
    },
    update: {
      limits: {
        ...priorLimits,
        mctbServiceStatus: "ACTIVE",
        adminUnlimitedMctb: true,
        mctbRecoveriesPeriodKey: periodKey,
        mctbRecoveriesUsed: 0,
        trialSmsSegmentLimit: null,
      },
    },
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      billingPlan: "pro",
      stripeSubscriptionId: `admin_grant_${workspaceId}_bundle`,
      customFieldsConfig: {
        ...cfg,
        mctb: {
          ...mctb,
          unlimitedMctbTesting: true,
        },
        billing: {
          ...(cfg.billing && typeof cfg.billing === "object"
            ? (cfg.billing as Record<string, unknown>)
            : {}),
          adminUnlimited: true,
        },
      },
    },
  });

  await saveLeadRecoveryConfig(workspaceId, { enabled: true });

  const afterCommercial = await resolveMctbCommercialEntitlements(workspaceId);
  const afterCaps = await resolveMctbCapabilities(workspaceId);
  const lead = await import("@/lib/mctb/lead-recovery/config").then((m) =>
    m.loadLeadRecoveryConfig(workspaceId),
  );

  console.log("\n✅ Granted full AI Recovery stack");
  console.log(
    JSON.stringify(
      {
        grantId: randomUUID(),
        workspaceId,
        afterCommercial,
        afterCaps,
        leadRecoveryEnabled: lead.enabled,
        policyHealth: lead.policyHealth,
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
