#!/usr/bin/env tsx
/**
 * Serial appointments frontend certification — ONE browser, ONE page at a time.
 *
 *   npx tsx scripts/appointments-frontend-certify-serial.ts next
 *   npx tsx scripts/appointments-frontend-certify-serial.ts overview
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./ui-agent/config";

const QA_PROGRESS = join(REPO_ROOT, "docs/appointments-frontend-certification.md");

const ORDER = [
  "overview",
  "calendar",
  "scheduled",
  "detail",
  "types",
  "availability",
  "reminders",
  "booking",
  "public-booking",
  "setup",
  "analytics",
  "conversations",
  "contacts",
] as const;

const LABEL: Record<string, string> = {
  overview: "Overview",
  calendar: "Calendar",
  scheduled: "Scheduled",
  detail: "Appointment Detail",
  types: "Appointment Types",
  availability: "Availability",
  reminders: "Reminder Settings",
  booking: "Booking Settings",
  "public-booking": "Public Booking",
  setup: "Get Started",
  analytics: "Analytics",
  conversations: "Conversations Integration",
  contacts: "Contacts Integration",
};

const NUM: Record<string, number> = {
  overview: 1,
  calendar: 2,
  scheduled: 3,
  detail: 4,
  types: 5,
  availability: 6,
  reminders: 7,
  booking: 8,
  "public-booking": 9,
  setup: 10,
  analytics: 11,
  conversations: 12,
  contacts: 13,
};

function readProgress(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(QA_PROGRESS)) return out;
  const text = readFileSync(QA_PROGRESS, "utf8");
  for (const [id, label] of Object.entries(LABEL)) {
    const row = text.match(new RegExp(`\\| ${NUM[id]} \\| ${label} \\| ([^|]+) \\|`));
    if (row) out[id] = row[1].trim();
  }
  return out;
}

function updateProgress(id: string, status: string, commit: string, notes = "") {
  const label = LABEL[id];
  const n = NUM[id];
  let text = readFileSync(QA_PROGRESS, "utf8");
  const row = `| ${n} | ${label} | ${status} | ${commit} | ${notes} |`;
  text = text.replace(new RegExp(`\\| ${n} \\| ${label} \\|[^\\n]+`), row);
  writeFileSync(QA_PROGRESS, text);
}

function nextPage(): string | undefined {
  const progress = readProgress();
  return ORDER.find((id) => !progress[id]?.startsWith("PASS"));
}

function runCertify(id: string): void {
  const base =
    process.env.UI_AGENT_BASE_URL?.trim() ||
    process.env.PLAYWRIGHT_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "[REDACTED]"; // pragma: allowlist secret
  execSync(`npx tsx scripts/appointments-frontend-certify-page.ts ${id}`, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BASE_URL: base,
      UI_AGENT_BASE_URL: base,
    },
  });
}

function checkpoint(id: string): string {
  try {
    execSync(
      `git add docs/appointments-frontend-certification.md scripts/appointments-frontend-certify-page.ts scripts/appointments-frontend-certify-serial.ts`,
      { cwd: REPO_ROOT, stdio: "pipe" },
    );
    const results = join("/opt/cursor/artifacts/appointments-frontend-cert", `${id}.json`);
    if (existsSync(results)) {
      execSync(`git add ${results}`, { cwd: REPO_ROOT, stdio: "pipe" });
    }
    execSync(`git commit -m "cert(appointments): ${LABEL[id]} PASS frontend"`, {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "no-changes";
  }
}

async function certifyOne(id: string) {
  console.log(`\n=== FRONTEND CERT: ${LABEL[id]} (${id}) ===\n`);
  try {
    runCertify(id);
    updateProgress(id, "PASS", "pending", "frontend cert");
    const commit = checkpoint(id);
    updateProgress(id, "PASS", commit, "frontend cert");
    console.log(`\n✓ ${LABEL[id]} PASS — commit ${commit}\n`);
  } catch (err) {
    updateProgress(id, "FAIL", "—", err instanceof Error ? err.message.slice(0, 80) : "failed");
    throw err;
  }
}

async function main() {
  const [cmd] = process.argv.slice(2);
  const only = cmd === "next" ? nextPage() : cmd;
  if (!only || !ORDER.includes(only as (typeof ORDER)[number])) {
    const progress = readProgress();
    console.log("Usage: npx tsx scripts/appointments-frontend-certify-serial.ts <next|overview|calendar|...>");
    console.log("\nProgress:");
    for (const id of ORDER) {
      console.log(`  ${LABEL[id]}: ${progress[id] || "NOT TESTED"}`);
    }
    process.exit(1);
  }
  await certifyOne(only);
}

main().catch(() => process.exit(1));
