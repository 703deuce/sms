/**
 * SMS Product Certification — backend orchestrator (Parts 2-3, 11-12, 15, 20, 26, 42-44).
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-sms-product-certification.ts
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import { getPrisma } from "../src/lib/db";
import { isSupabaseConfigured } from "../src/lib/supabase/admin";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { validateBulkRecipients } from "../src/lib/campaigns/enroll-campaign";
import { estimateMessagingCredits } from "../src/lib/mass-texting/credit-units";
import { validateCampaignMediaConfig } from "../src/lib/mass-texting/campaign-media";
import { canLegacyActivateCampaign } from "../src/lib/mass-texting/campaign-guards";

type Gate = { name: string; status: "PASS" | "FAIL" | "BLOCKED"; detail?: string };

const gates: Gate[] = [];

for (const file of [".env.local", ".env"]) {
  const path = join(process.cwd(), file);
  if (existsSync(path)) dotenv.config({ path });
}

/** Per-script subprocess cap — fail fast instead of hanging indefinitely. */
const SCRIPT_TIMEOUT_MS = Number(process.env.SMS_CERT_SCRIPT_TIMEOUT_MS || 60000);
const DB_PUSH_TIMEOUT_MS = Number(process.env.SMS_CERT_DB_PUSH_TIMEOUT_MS || 45000);
const DB_GATE_TIMEOUT_MS = Number(process.env.SMS_CERT_DB_GATE_TIMEOUT_MS || 90000);
const SKIP_DB_PUSH = process.env.SMS_CERT_RUN_DB_PUSH !== "1";

function withTimeout<T>(label: string, ms: number, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
    fn()
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function gate(name: string, pass: boolean, detail?: string, blocked = false) {
  const status = blocked ? "BLOCKED" : pass ? "PASS" : "FAIL";
  gates.push({ name, status, detail });
  const mark = status === "PASS" ? "✓" : status === "BLOCKED" ? "○" : "✗";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function createWorkspace(label: string) {
  const suffix = randomBytes(4).toString("hex");
  const ws = await getPrisma().workspace.create({
    data: { name: `${label} ${suffix}`, slug: `${label}-${suffix}`, type: "BUSINESS" },
  });
  return ws.id;
}

async function cleanupWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.campaignLaunchAudit.deleteMany({ where: { workspaceId } });
  await prisma.massTextingCreditReservation.deleteMany({ where: { workspaceId } });
  await prisma.massTextingBillingAccount.deleteMany({ where: { workspaceId } });
  await prisma.campaignMessage.deleteMany({ where: { workspaceId } });
  await prisma.campaignRecipient.deleteMany({ where: { workspaceId } });
  await prisma.campaign.deleteMany({ where: { workspaceId } });
  const lists = await prisma.contactList.findMany({ where: { workspaceId }, select: { id: true } });
  if (lists.length) {
    await prisma.contactListMember.deleteMany({ where: { listId: { in: lists.map((l) => l.id) } } });
  }
  await prisma.contactList.deleteMany({ where: { workspaceId } });
  await prisma.contact.deleteMany({ where: { workspaceId } });
  await prisma.messagingProductRegistration.deleteMany({ where: { workspaceId } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
}

async function tenantIsolationTests() {
  const wsA = await createWorkspace("sms-cert-a");
  const wsB = await createWorkspace("sms-cert-b");
  try {
    const contactA = await getPrisma().contact.create({
      data: { workspaceId: wsA, phone: "+14155551001", firstName: "A" },
    });
    const campaignB = await getPrisma().campaign.create({
      data: {
        workspaceId: wsB,
        name: "B campaign",
        type: "Promotional",
        audience: "Test",
        body: "Hello",
        status: "DRAFT",
      },
    });

    const cross = await getPrisma().contact.findFirst({
      where: { id: contactA.id, workspaceId: wsB },
    });
    gate("TENANT ISOLATION contacts", cross === null);

    const crossCampaign = await getPrisma().campaign.findFirst({
      where: { id: campaignB.id, workspaceId: wsA },
    });
    gate("TENANT ISOLATION campaigns", crossCampaign === null);
  } finally {
    await cleanupWorkspace(wsA);
    await cleanupWorkspace(wsB);
  }
}

async function launchGuardTests() {
  const ws = await createWorkspace("sms-launch-guard");
  try {
    await grantWorkspaceProductFeature(ws, "mass_texting", "trial");
    const campaign = await getPrisma().campaign.create({
      data: {
        workspaceId: ws,
        name: "Guard test",
        type: "Promotional",
        audience: "Test",
        body: "Hello",
        status: "DRAFT",
      },
    });
    const gateResult = await canLegacyActivateCampaign(ws, campaign.id);
    gate("LAUNCH BYPASS blocked without audit", !gateResult.allowed, gateResult.reason);
  } finally {
    await cleanupWorkspace(ws);
  }
}

async function creditAccountingTests() {
  gate(
    "SMS SEGMENT CREDITS single segment",
    estimateMessagingCredits({ recipientCount: 10, smsSegmentsPerRecipient: 1, isMms: false }) === 10,
  );
  gate(
    "SMS SEGMENT CREDITS multi-segment",
    estimateMessagingCredits({ recipientCount: 5, smsSegmentsPerRecipient: 3, isMms: false }) === 15,
  );
  gate(
    "MMS CREDIT ACCOUNTING",
    estimateMessagingCredits({ recipientCount: 4, smsSegmentsPerRecipient: 1, isMms: true }) === 12,
  );
}

async function mmsValidationTests() {
  const bad = validateCampaignMediaConfig({ configJson: {}, campaignType: "MMS Broadcast" });
  gate("MMS validation rejects missing media", !bad.ok);
  const good = validateCampaignMediaConfig({
    configJson: { mediaUrls: ["https://example.com/a.jpg"] },
    campaignType: "MMS",
  });
  gate("MMS validation accepts media", good.ok);
}

async function suppressionTests() {
  const ws = await createWorkspace("sms-suppress");
  try {
    const phone = `+1415555${String(Date.now()).slice(-4)}`;
    await getPrisma().suppression.create({
      data: {
        workspaceId: ws,
        phone,
        suppressionKey: `p:${phone}`,
        reason: "STOP",
        source: "test",
      },
    });
    const campaign = await getPrisma().campaign.create({
      data: {
        workspaceId: ws,
        name: "Suppress test",
        type: "Promotional",
        audience: "Test",
        body: "Hi",
        status: "DRAFT",
      },
    });
    const { rejected } = await validateBulkRecipients(ws, campaign.id, [{ phone }]);
    gate(
      "SUPPRESSION blocks opted-out contact",
      rejected.some((r) => r.reason === "suppressed"),
    );
  } finally {
    await cleanupWorkspace(ws);
  }
}

async function setupMassTextingWorkspace(workspaceId: string) {
  const prisma = getPrisma();
  await grantWorkspaceProductFeature(workspaceId, "mass_texting", "trial");
  await prisma.messagingProductRegistration.upsert({
    where: {
      workspaceId_productUseCase: { workspaceId, productUseCase: "MASS_TEXT_MARKETING" },
    },
    create: {
      workspaceId,
      productUseCase: "MASS_TEXT_MARKETING",
      overallStatus: "approved",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: "+14155550199",
    },
    update: {
      overallStatus: "approved",
      messagingEnabled: true,
      phoneAttached: true,
      phoneE164: "+14155550199",
    },
  });
  const { getOrCreateMassTextingBillingAccount, updateMassTextingLifecycle } = await import(
    "../src/lib/mass-texting/billing-account"
  );
  await getOrCreateMassTextingBillingAccount(workspaceId);
  await updateMassTextingLifecycle(workspaceId, "TRIAL_ACTIVE", {
    trialStartedAt: new Date(),
    trialEndsAt: new Date(Date.now() + 14 * 86400000),
    trialSegmentsUsed: 0,
  });
}

async function duplicateLaunchTests() {
  const ws = await createWorkspace("sms-idem");
  try {
    await setupMassTextingWorkspace(ws);
    const phone = `+1415555${String(Date.now()).slice(-4)}`;
    const contact = await getPrisma().contact.create({
      data: { workspaceId: ws, phone, firstName: "Test", status: "SUBSCRIBED" },
    });
    const list = await getPrisma().contactList.create({
      data: { workspaceId: ws, name: "Test list" },
    });
    await getPrisma().contactListMember.create({
      data: { listId: list.id, contactId: contact.id },
    });
    const campaign = await getPrisma().campaign.create({
      data: {
        workspaceId: ws,
        name: "Idem test",
        type: "Promotional",
        audience: "List",
        body: "Hello {{firstName}}",
        status: "DRAFT",
        configJson: { listIds: [list.id] },
      },
    });

    const key = `launch:test:${randomBytes(4).toString("hex")}`;
    const { launchCampaignWithAudit } = await import("../src/lib/mass-texting/campaign-launch");
    const r1 = await launchCampaignWithAudit({
      workspaceId: ws,
      campaignId: campaign.id,
      idempotencyKey: key,
    });
    const r2 = await launchCampaignWithAudit({
      workspaceId: ws,
      campaignId: campaign.id,
      idempotencyKey: key,
    });
    gate(
      "DUPLICATE SEND PROTECTION idempotent launch",
      r1.ok && r2.ok && r2.idempotentReplay === true,
      r1.ok ? undefined : (r1 as { error: string }).error,
    );
  } finally {
    await cleanupWorkspace(ws);
  }
}

function runScript(script: string, options?: { preloadServerOnly?: boolean }) {
  console.log(`… ${script} (timeout ${SCRIPT_TIMEOUT_MS}ms)`);
  const env = { ...process.env };
  if (options?.preloadServerOnly) {
    env.NODE_OPTIONS = [
      env.NODE_OPTIONS,
      "--import ./scripts/preload-server-only.mjs",
    ]
      .filter(Boolean)
      .join(" ");
  }
  execSync(`npx tsx ${script}`, {
    stdio: "pipe",
    env,
    shell: true,
    timeout: SCRIPT_TIMEOUT_MS,
  });
}

function artifactsDir() {
  return process.env.SMS_CERT_ARTIFACTS_DIR || join(process.cwd(), "artifacts");
}

async function main() {
  console.log("=== SMS Product Backend Certification ===\n");

  const hasDb = isSupabaseConfigured();
  const hasPrismaUrl = Boolean(process.env.DATABASE_URL?.trim());
  if (!hasDb) {
    console.log("○ Supabase env not set — DB integration gates will be BLOCKED (not FAIL).\n");
  }

  try {
    runScript("scripts/test-mass-texting-boundary.ts");
    gate("MASS TEXTING boundary imports", true);
  } catch (e) {
    gate("MASS TEXTING boundary imports", false, String(e));
  }

  for (const script of [
    "scripts/test-mass-texting-inbox-filters.ts",
    "scripts/test-mass-texting-pricing-billing.ts",
    "scripts/test-mass-texting-integration.ts",
    "scripts/test-mass-texting-campaign-guards.ts",
    "scripts/test-preferred-sending-number.ts",
    "scripts/test-v1-sms-cert-code-gates.ts",
  ]) {
    try {
      runScript(script);
      gate(script.replace("scripts/", "").replace(".ts", ""), true);
    } catch (e) {
      gate(script.replace("scripts/", "").replace(".ts", ""), false, String(e));
    }
  }

  if (!hasDb) {
    gate("CREDIT RESERVATION", false, "Supabase env not set", true);
  } else {
    try {
      runScript("scripts/test-mass-texting-credit-reservations.ts", {
        preloadServerOnly: true,
      });
      gate("CREDIT RESERVATION", true);
    } catch (e) {
      gate("CREDIT RESERVATION", false, String(e));
    }
  }

  if (!hasDb) {
    gate("TENANT ISOLATION contacts", false, "Supabase env not set", true);
    gate("TENANT ISOLATION campaigns", false, "Supabase env not set", true);
    gate("LAUNCH BYPASS blocked without audit", false, "Supabase env not set", true);
    gate("SUPPRESSION blocks opted-out contact", false, "Supabase env not set", true);
    gate("DUPLICATE SEND PROTECTION idempotent launch", false, "Supabase env not set", true);
    gate("DATABASE schema in sync", false, "DATABASE_URL not set", true);
  } else {
    try {
      await withTimeout("tenant isolation", DB_GATE_TIMEOUT_MS, tenantIsolationTests);
    } catch (e) {
      gate("TENANT ISOLATION contacts", false, String(e));
      gate("TENANT ISOLATION campaigns", false, String(e));
    }
    try {
      await withTimeout("launch guard", DB_GATE_TIMEOUT_MS, launchGuardTests);
    } catch (e) {
      gate("LAUNCH BYPASS blocked without audit", false, String(e));
    }
    await creditAccountingTests();
    await mmsValidationTests();
    try {
      await withTimeout("suppression", DB_GATE_TIMEOUT_MS, suppressionTests);
    } catch (e) {
      gate("SUPPRESSION blocks opted-out contact", false, String(e));
    }
    try {
      await withTimeout("duplicate launch", DB_GATE_TIMEOUT_MS, duplicateLaunchTests);
    } catch (e) {
      gate("DUPLICATE SEND PROTECTION idempotent launch", false, String(e));
    }

    if (!hasPrismaUrl) {
      gate("DATABASE schema in sync", false, "DATABASE_URL not set", true);
    } else if (SKIP_DB_PUSH) {
      gate("DATABASE schema in sync", false, "skipped (set SMS_CERT_RUN_DB_PUSH=1 to run)", true);
    } else {
      try {
        console.log(`… npm run db:push (timeout ${DB_PUSH_TIMEOUT_MS}ms)`);
        execSync("npm run db:push", {
          stdio: "pipe",
          encoding: "utf8",
          shell: true,
          timeout: DB_PUSH_TIMEOUT_MS,
        });
        gate("DATABASE schema in sync", true);
      } catch (e) {
        gate("DATABASE schema in sync", false, String(e));
      }
    }
  }

  if (!hasDb) {
    await creditAccountingTests();
    await mmsValidationTests();
  }

  const failed = gates.filter((g) => g.status === "FAIL");
  const blocked = gates.filter((g) => g.status === "BLOCKED");
  const passed = gates.filter((g) => g.status === "PASS");

  const report = {
    generatedAt: new Date().toISOString(),
    summary: { pass: passed.length, fail: failed.length, blocked: blocked.length },
    gates,
  };

  mkdirSync(artifactsDir(), { recursive: true });
  const reportPath = join(artifactsDir(), "sms-product-backend-certification.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n=== Backend Summary: ${passed.length} PASS, ${failed.length} FAIL, ${blocked.length} BLOCKED ===`);
  if (failed.length) {
    console.error("\nFailed gates:");
    for (const f of failed) console.error(`  - ${f.name}: ${f.detail || ""}`);
    process.exit(1);
  }
  console.log(`\nWrote ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
