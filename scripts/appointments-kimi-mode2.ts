#!/usr/bin/env tsx
/**
 * Appointments Kimi Mode 2 — visual fidelity pass.
 *
 * Serial local capture (one browser) → concurrent Kimi polish jobs (remote).
 *
 *   DEV_AUTH_BYPASS=1 npx tsx scripts/appointments-kimi-mode2.ts capture
 *   npx tsx scripts/appointments-kimi-mode2.ts kimi [--only overview] [--concurrency 7]
 *   npx tsx scripts/appointments-kimi-mode2.ts kimi-one overview
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { KimiVisionProvider } from "./ui-agent/kimi-client";
import {
  type ScreenshotPolishBatch,
  type ScreenshotPolishJob,
} from "./ui-agent/kimi-screenshot-batch";
import { runKimiPolishCommand } from "./ui-agent/kimi-polish";
import { REPO_ROOT } from "./ui-agent/config";
import type { CliOptions } from "./ui-agent/types";

const JOBS_PATH = join(REPO_ROOT, ".ui-agent/batch/appointments-mode2-jobs.json");
const QA_PROGRESS = join(REPO_ROOT, "docs/appointments-qa-progress.md");
const BASE =
  process.env.UI_AGENT_BASE_URL?.trim() ||
  process.env.PLAYWRIGHT_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://transovo.ai"; // pragma: allowlist secret
const AUTH_EMAIL = process.env.DEV_AUTH_BYPASS_EMAIL || "alex@harborhome.co";

const PAGE_WAIT: Record<string, { heading: string; content?: string }> = {
  overview: { heading: "Overview", content: "Upcoming appointments" },
  calendar: { heading: "Calendar", content: "Manage your appointments" },
  "appointment-types": { heading: "Appointment Types", content: "Manage the services" },
  availability: { heading: "Availability", content: "Booking rules" },
  "reminder-settings": { heading: "Reminder Settings", content: "Reminder sequence" },
  booking: { heading: "Booking", content: "Public booking" },
  "get-started": { heading: "Get Started", content: "Set up your booking" },
};

function loadJobs(): ScreenshotPolishBatch {
  return JSON.parse(readFileSync(JOBS_PATH, "utf8")) as ScreenshotPolishBatch;
}

function parseArg(args: string[], flag: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

async function gotoRoute(page: import("playwright").Page, path: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      return;
    } catch (err) {
      if (attempt === 3) throw err;
      await page.waitForTimeout(2000 * attempt);
    }
  }
}

async function waitForPageReady(page: import("playwright").Page, jobId: string) {
  const cfg = PAGE_WAIT[jobId];
  await page.waitForFunction(() => !document.querySelector(".animate-pulse"), undefined, {
    timeout: 120_000,
  }).catch(() => {});
  if (cfg?.heading) {
    await page.getByRole("heading", { name: cfg.heading }).first().waitFor({
      state: "visible",
      timeout: 120_000,
    });
  }
  if (cfg?.content) {
    await page.getByText(cfg.content, { exact: false }).first().waitFor({
      state: "visible",
      timeout: 120_000,
    }).catch(() => {});
  }
  await page.waitForTimeout(2000);
}

async function captureSerial(): Promise<void> {
  const batch = loadJobs();
  const outDir = join(REPO_ROOT, ".ui-agent/screenshots/appointments-mode2/current");
  mkdirSync(outDir, { recursive: true });

  console.log(`\n=== Appointments Mode 2: serial capture (1 browser) ===`);
  console.log(`Target: ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(
      `${BASE}/api/auth/dev-bypass?email=${encodeURIComponent(AUTH_EMAIL)}&next=${encodeURIComponent("/appointments/overview")}`,
      { waitUntil: "domcontentloaded", timeout: 120_000 },
    );
    await page.waitForTimeout(2000);

    for (const job of batch.jobs) {
      console.log(`Capturing ${job.id} → ${job.path}`);
      await gotoRoute(page, job.path);
      await waitForPageReady(page, job.id);
      const dest = join(REPO_ROOT, job.screenshot);
      mkdirSync(join(dest, ".."), { recursive: true });
      await page.screenshot({ path: dest, fullPage: true });
      console.log(`  saved ${job.screenshot}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log("\nCapture complete.\n");
}

function buildPolishOptions(job: ScreenshotPolishJob, instruction: string): CliOptions {
  const hasTarget = Boolean(job.targetScreenshot && existsSync(join(REPO_ROOT, job.targetScreenshot)));
  return {
    mode: "polish",
    target: job.target,
    referenceImages: hasTarget ? [join(REPO_ROOT, job.targetScreenshot!)] : [],
    referenceVideos: [],
    referenceUrls: [],
    referenceNames: [],
    referenceVideoNames: [],
    referenceImageNames: [],
    currentImages: [join(REPO_ROOT, job.screenshot)],
    currentVideos: [],
    captureCurrent: false,
    captureScreenshots: false,
    captureVideo: false,
    referenceDepth: "page",
    planOnly: false,
    apply: true,
    dryRun: false,
    analyzeOnly: false,
    approve: false,
    integrate: false,
    revise: false,
    complete: false,
    walkthrough: false,
    skipAutoReference: !hasTarget,
    baseUrl: BASE,
    viewports: ["desktop"],
    maxPasses: 1,
    reasoningEffort: "low",
    instruction: job.instruction || instruction,
  };
}

function updateQaProgress(jobId: string, status: string, commit?: string) {
  if (!existsSync(QA_PROGRESS)) return;
  const labelMap: Record<string, string> = {
    overview: "Overview",
    calendar: "Calendar",
    "appointment-types": "Appointment Types",
    availability: "Availability",
    "reminder-settings": "Reminder Settings",
    booking: "Booking",
    "get-started": "Get Started",
  };
  const label = labelMap[jobId] || jobId;
  let text = readFileSync(QA_PROGRESS, "utf8");
  const row = `| ${label} |`;
  const replacement = `| ${label} | ${status} | ${commit || "—"} |`;
  text = text.replace(new RegExp(`\\| ${label} \\|[^\\n]+`), replacement);
  writeFileSync(QA_PROGRESS, text);
}

function checkpointCommit(jobId: string, sessionId: string): string {
  try {
    execSync(`git add -A && git commit -m "ui-fidelity(appointments): Kimi Mode 2 ${jobId} [session ${sessionId}]"`, {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
    return execSync("git rev-parse --short HEAD", { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return "no-changes";
  }
}

async function runKimiJob(job: ScreenshotPolishJob, instruction: string): Promise<void> {
  if (!existsSync(join(REPO_ROOT, job.screenshot))) {
    throw new Error(`Missing current screenshot: ${job.screenshot} — run capture first`);
  }
  console.log(`\nKimi Mode 2 → ${job.id}`);
  const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });
  const result = await runKimiPolishCommand(provider, buildPolishOptions(job, instruction));
  const commit = checkpointCommit(job.id, result.sessionId);
  updateQaProgress(job.id, "KIMI APPLIED", commit);
  console.log(`✓ ${job.id} — ${result.touchedFiles.length} files — commit ${commit}`);
}

async function runKimiBatch(only?: string, concurrency = 7): Promise<void> {
  const batch = loadJobs();
  const jobs = only ? batch.jobs.filter((j) => j.id === only) : batch.jobs;
  if (!jobs.length) throw new Error(`No jobs matched: ${only || "all"}`);

  console.log(`\n=== Appointments Mode 2: Kimi polish (${jobs.length} job(s), concurrency=${concurrency}) ===\n`);

  if (concurrency <= 1) {
    for (const job of jobs) {
      await runKimiJob(job, batch.instruction);
    }
    return;
  }

  let cursor = 0;
  let active = 0;
  let done = 0;
  const total = jobs.length;
  const errors: string[] = [];

  await new Promise<void>((resolve) => {
    const pump = () => {
      while (active < concurrency && cursor < total) {
        const job = jobs[cursor++];
        active++;
        runKimiJob(job, batch.instruction)
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${job.id}: ${msg}`);
            updateQaProgress(job.id, "KIMI FAIL");
          })
          .finally(() => {
            active--;
            done++;
            if (done >= total && active === 0) resolve();
            else pump();
          });
      }
    };
    pump();
  });

  if (errors.length) {
    console.error("\nFailures:\n" + errors.join("\n"));
    process.exit(1);
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "capture") {
    await captureSerial();
    return;
  }
  if (cmd === "kimi") {
    const only = parseArg(rest, "--only");
    const concurrency = Number(parseArg(rest, "--concurrency") || process.env.KIMI_MODE2_CONCURRENCY || 7);
    await runKimiBatch(only, concurrency);
    return;
  }
  if (cmd === "kimi-one") {
    const id = rest[0];
    if (!id) throw new Error("Usage: appointments-kimi-mode2.ts kimi-one <page-id>");
    await runKimiBatch(id, 1);
    return;
  }

  console.log(`Usage:
  DEV_AUTH_BYPASS=1 npx tsx scripts/appointments-kimi-mode2.ts capture
  npx tsx scripts/appointments-kimi-mode2.ts kimi [--only overview] [--concurrency 7]
  npx tsx scripts/appointments-kimi-mode2.ts kimi-one overview`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
