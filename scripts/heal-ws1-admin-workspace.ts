/**
 * Heal Workspace One (admin): dual-channel carrier provision on every number +
 * admin unlimited flags + active MCTB/SMS entitlements.
 *
 * Carrier: same as all customers (MCTB TeXML + SMS on every DID).
 * App: admin unlimited credits + MCTB always active (not SKU-gated).
 *
 *   NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *     npx tsx scripts/heal-ws1-admin-workspace.ts --apply
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

for (const file of [".env.local", ".env"]) {
  const p = join(process.cwd(), file);
  if (existsSync(p)) config({ path: p });
}

import { getPrisma } from "@/lib/db";
import { updateMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";
import { clearMctbServiceSuspension } from "@/lib/mctb/entitlement";
import { grantProductEntitlement } from "@/lib/products/entitlements";
import { enqueueMessagingRegistrationAdvance } from "@/lib/messaging/enqueue-advance";
import {
  ensureDefaultNonTelnyxNumberProvision,
  ensureDefaultTelnyxMctbAndSmsProvision,
} from "@/lib/mctb/provisioning/dual-channel-repair";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const workspaceId =
  (args.includes("--workspace-id") ? args[args.indexOf("--workspace-id") + 1] : null) ||
  process.env.MCTB_ADMIN_WORKSPACE_ID?.trim() ||
  "ws_1";

const CREDIT_BALANCE_CENTS = 1_000_000_00;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function healAdminFlags() {
  const prisma = getPrisma();
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { customFieldsConfig: true, creditBalanceCents: true, billingPlan: true },
  });
  if (!ws) throw new Error(`Workspace not found: ${workspaceId}`);

  const cfg = asRecord(ws.customFieldsConfig);
  const mctb = asRecord(cfg.mctb);
  const billing = asRecord(cfg.billing);
  const limitsRow = await prisma.workspaceLimits.findUnique({ where: { workspaceId } });
  const priorLimits = asRecord(limitsRow?.limits);

  if (!apply) {
    return {
      creditBalanceCents: CREDIT_BALANCE_CENTS,
      adminTestAccount: true,
      unlimitedMctbTesting: true,
      adminUnlimitedMctb: true,
      adminUnlimitedCredits: true,
    };
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      creditBalanceCents: CREDIT_BALANCE_CENTS,
      billingPlan: ws.billingPlan === "canceled" || ws.billingPlan === "expired" ? "growth" : ws.billingPlan,
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
        mctbServiceStatus: "ACTIVE",
      },
    },
    update: {
      limits: {
        ...priorLimits,
        adminUnlimitedMctb: true,
        adminUnlimitedCredits: true,
        mctbServiceStatus: "ACTIVE",
      },
    },
  });

  await clearMctbServiceSuspension(workspaceId);

  for (const product of ["voice", "sms", "numbers"] as const) {
    await grantProductEntitlement(workspaceId, product, "active");
  }

  return { ok: true };
}

async function healAllNumbers() {
  const prisma = getPrisma();
  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId, status: { not: "Released" } },
    select: { id: true, e164: true, provider: true, providerNumberId: true },
    orderBy: { purchasedAt: "asc" },
  });

  const results: Array<{ e164: string; ok: boolean; error?: string }> = [];

  for (const phone of phones) {
    if (!apply) {
      results.push({ e164: phone.e164, ok: true });
      continue;
    }
    try {
      const provider = String(phone.provider || "").toLowerCase();
      if (provider === "telnyx") {
        await ensureDefaultTelnyxMctbAndSmsProvision({
          workspaceId,
          phoneNumberId: phone.id,
        });
      } else {
        await ensureDefaultNonTelnyxNumberProvision({
          workspaceId,
          phoneNumberId: phone.id,
        });
      }
      results.push({ e164: phone.e164, ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ e164: phone.e164, ok: false, error: message });
    }
  }

  return results;
}

async function healMctbRuntime() {
  const runtime = await loadMissedCallTextConfig(workspaceId);
  if (!runtime.phoneNumberId) {
    return { skipped: true, reason: "no_phone_number_id_in_config" };
  }

  if (!apply) {
    return { wouldEnable: true, phoneNumberId: runtime.phoneNumberId };
  }

  await updateMissedCallTextConfig({
    workspaceId,
    patch: {
      enabled: true,
      phone_number_id: runtime.phoneNumberId,
      sms_phone_number_id: runtime.smsPhoneNumberId || runtime.phoneNumberId,
    },
    source: "ws1_admin_heal",
  });

  await enqueueMessagingRegistrationAdvance(workspaceId).catch(() => undefined);

  return { enabled: true, phoneNumberId: runtime.phoneNumberId };
}

async function main() {
  console.log("\n══ Heal Workspace One (admin) ══\n");
  console.log(`Workspace: ${workspaceId}`);
  console.log(`Mode:      ${apply ? "APPLY" : "dry-run"}\n`);

  const prisma = getPrisma();
  const phones = await prisma.phoneNumber.findMany({
    where: { workspaceId, status: { not: "Released" } },
    select: { id: true, e164: true, provider: true },
  });
  console.log(`Numbers (${phones.length}):`);
  for (const p of phones) {
    console.log(`  ${p.e164}  ${p.provider}  ${p.id}`);
  }

  const runtime = await loadMissedCallTextConfig(workspaceId);
  console.log(`\nMCTB active DID: ${runtime.phoneNumberId || "(none)"} enabled=${runtime.enabled}`);

  const admin = await healAdminFlags();
  console.log("\n── Admin flags ──");
  console.log(JSON.stringify(admin, null, 2));

  const numberResults = await healAllNumbers();
  console.log("\n── Dual-channel provision ──");
  for (const r of numberResults) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.e164}${r.error ? ` — ${r.error}` : ""}`);
  }

  const mctb = await healMctbRuntime();
  console.log("\n── MCTB runtime ──");
  console.log(JSON.stringify(mctb, null, 2));

  if (!apply) {
    console.log("\n📋 Dry-run only. Re-run with --apply to heal.");
    return;
  }

  const { getMctbEntitlement } = await import("@/lib/mctb/entitlement");
  const { isAdminUnlimitedWorkspace } = await import("@/lib/billing/admin-unlimited-workspace");
  const entitlement = await getMctbEntitlement(workspaceId);
  const unlimited = await isAdminUnlimitedWorkspace(workspaceId);

  console.log("\n── Post-heal status ──");
  console.log(
    JSON.stringify(
      {
        mctbEntitlement: entitlement,
        adminUnlimitedWorkspace: unlimited,
        numbersHealed: numberResults.filter((r) => r.ok).length,
        numbersFailed: numberResults.filter((r) => !r.ok).length,
      },
      null,
      2,
    ),
  );
  console.log("\n✅ ws_1 admin heal complete\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
