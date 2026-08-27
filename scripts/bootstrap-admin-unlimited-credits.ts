/**
 * Mark a workspace as admin-unlimited for SMS/credits (certification / platform admin).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/bootstrap-admin-unlimited-credits.ts --apply
 */
import { getPrisma } from "@/lib/db";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const workspaceId =
  (args.includes("--workspace-id") ? args[args.indexOf("--workspace-id") + 1] : null) ||
  process.env.WORKSPACE_ID ||
  "ws_1";

const CREDIT_BALANCE_CENTS = 1_000_000_00;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function main() {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      billingPlan: true,
      creditBalanceCents: true,
      stripeCustomerId: true,
      customFieldsConfig: true,
    },
  });
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);

  const limits = await prisma.workspaceLimits.findUnique({ where: { workspaceId } });
  const cfg = asRecord(ws.customFieldsConfig);
  const mctb = asRecord(cfg.mctb);
  const billing = asRecord(cfg.billing);
  const priorLimits = asRecord(limits?.limits);

  console.log("\n── Admin unlimited credits bootstrap ──\n");
  console.log(`Workspace: ${ws.name} (${workspaceId})`);
  console.log(`Plan:      ${ws.billingPlan}`);
  console.log(`Credits:   ${ws.creditBalanceCents} → ${CREDIT_BALANCE_CENTS}`);
  console.log(`Stripe:    ${ws.stripeCustomerId || "(none)"}`);

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to write.");
    return;
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      creditBalanceCents: CREDIT_BALANCE_CENTS,
      customFieldsConfig: {
        ...cfg,
        mctb: {
          ...mctb,
          adminTestAccount: true,
          unlimitedMctbTesting: true,
        },
        billing: {
          ...billing,
          adminUnlimited: true,
          unlimitedCredits: true,
        },
      },
    },
  });

  await prisma.workspaceLimits.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      limits: {
        ...priorLimits,
        adminUnlimitedMctb: true,
        adminUnlimitedCredits: true,
      },
    },
    update: {
      limits: {
        ...priorLimits,
        adminUnlimitedMctb: true,
        adminUnlimitedCredits: true,
      },
    },
  });

  const refreshed = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { creditBalanceCents: true, customFieldsConfig: true },
  });
  console.log("\n✅ Admin unlimited credits enabled");
  console.log(JSON.stringify(refreshed, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
