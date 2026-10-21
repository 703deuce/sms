#!/usr/bin/env npx tsx
/**
 * Ten BLOCKED audit items that require production DATABASE_URL:
 * S-07–S-15 + receptionist publish-pipeline dry-run (P2-SCRIPT-030).
 *
 * Run inside an environment with DB (not the standalone Next production image):
 *   NODE_OPTIONS='--import ../../scripts/preload-server-only.mjs' npx tsx scripts/phone-functional-audit/run-server-db-blocked-audit.ts
 *
 * Or: npm run test:phone:audit:server-db
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { createAuditReport } from "./audit-core.mjs";
import { runPhase4DbScenarios } from "./phase-4-db-scenarios";

const auditDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(auditDir, "..", "..");
const repoRoot = path.join(appRoot, "..");
const reportPath =
  process.env.PHONE_SERVER_DB_AUDIT_REPORT ||
  path.join("/opt/cursor/artifacts", "phone-server-db-blocked-audit.json");

if (!process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is required (hydrate from production web container or run via run-on-production-server.mjs)");
  process.exit(2);
}

const { record, writeReport } = createAuditReport(reportPath);

async function pickWorkspaceForPublishSim(prisma: PrismaClient): Promise<string | null> {
  const fromEnv = process.env.PHONE_AUDIT_WORKSPACE_ID?.trim();
  if (fromEnv) return fromEnv;

  const row = await prisma.workspace.findFirst({
    where: {
      phoneNumbers: { some: { status: "Active" } },
      voiceAgents: {
        some: {
          agentType: "appointment_receptionist",
          archivedAt: null,
        },
      },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  return row?.id ?? null;
}

async function runPublishPipelineDryRun(workspaceId: string, e164: string | null) {
  const sim = path.join(appRoot, "scripts", "simulate-receptionist-publish-pipeline.mjs");
  const preload = path.join(repoRoot, "scripts", "preload-server-only.mjs");
  const args = ["tsx", sim, "--workspace", workspaceId];
  if (e164) args.push("--e164", e164);

  const r = spawnSync("npx", args, {
    cwd: appRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_OPTIONS: `--import ${preload}`,
    },
    timeout: 300_000,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`.trim();
  const pass = r.status === 0;
  record(
    "P2-SCRIPT-030",
    "Script suite (DB)",
    "simulate-receptionist-publish-pipeline.mjs dry-run",
    "exit 0",
    pass ? "exit 0" : `exit ${r.status ?? "null"}`,
    pass ? "PASS" : "FAIL",
    out.slice(-2000),
  );
  return pass;
}

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    record(
      "SRV-DB-CONNECT",
      "Server DB audit",
      "prisma.$queryRaw SELECT 1",
      "ok",
      "ok",
      "PASS",
    );

    await runPhase4DbScenarios(record);

    const workspaceId = await pickWorkspaceForPublishSim(prisma);
    if (!workspaceId) {
      record(
        "P2-SCRIPT-030",
        "Script suite (DB)",
        "simulate-receptionist-publish-pipeline.mjs",
        "workspace with receptionist + active number",
        "none found",
        "FAIL",
      );
    } else {
      const phone = await prisma.phoneNumber.findFirst({
        where: { workspaceId, status: "Active" },
        select: { e164: true },
        orderBy: { createdAt: "desc" },
      });
      await runPublishPipelineDryRun(workspaceId, phone?.e164 ?? null);
    }

    const { summary, mdPath } = writeReport({
      mode: "server-db-blocked",
      baseUrl: process.env.PHONE_TEST_BASE_URL || null,
      databaseUrlAvailable: true,
    });

    const exitCode = summary.totals.FAIL > 0 ? 1 : 0;
    console.log(
      `SERVER DB audit: PASS=${summary.totals.PASS} FAIL=${summary.totals.FAIL} BLOCKED=${summary.totals.BLOCKED} exit=${exitCode}`,
    );
    console.log(`Report: ${mdPath}`);
    process.exit(exitCode);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
