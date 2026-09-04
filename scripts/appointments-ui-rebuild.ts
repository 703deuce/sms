#!/usr/bin/env tsx
/**
 * Appointments UI rebuild — Kimi Mode 1 screenshot recreation.
 *
 *   npx tsx scripts/appointments-ui-rebuild.ts recreate
 *   npx tsx scripts/appointments-ui-rebuild.ts status
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KimiVisionProvider } from "./ui-agent/kimi-client";
import { runKimiCommand } from "./ui-agent/kimi-command";
import { draftDirForSession } from "./ui-agent/kimi-persist";
import { REPO_ROOT } from "./ui-agent/config";
import type { CliOptions } from "./ui-agent/types";

const UI_REBUILD_DIR = join(REPO_ROOT, "ui-rebuild");
const STATE_PATH = join(UI_REBUILD_DIR, "rebuild-state.json");

const RECREATION_INSTRUCTION = `Recreate this screenshot as closely as possible as a production frontend page for the existing Transovo application.

Preserve the composition, visual hierarchy, spacing, sizing, card/panel structure, controls, typography hierarchy, and overall premium SaaS feel.

Use Transovo's real color system/branding (purple/indigo primary, clean SaaS neutrals) rather than blindly copying any generated placeholder colors.

Tighten spacing/alignment where necessary, but do NOT redesign the composition into something else.

This is an appointments product page inside the existing Transovo app shell (sidebar + top header already exist outside this page content area). Generate ONLY the page content region: page.tsx, components/**, mock-data.ts, reference.css.

Use mock/sample data only where needed for visual fidelity during recreation. Do not scaffold a new Next.js project.`;

export type RebuildJob = {
  id: string;
  route: string;
  label: string;
  screenshot: string;
  stagingDir: string;
  status: "pending" | "running" | "complete" | "failed";
  sessionId?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

export type RebuildState = {
  updatedAt: string;
  concurrency: number;
  staggerMs: number;
  jobs: RebuildJob[];
};

const JOBS: Omit<RebuildJob, "status">[] = [
  {
    id: "overview",
    route: "/appointments/overview",
    label: "Overview",
    screenshot: "ui-rebuild/references/overview.jpg",
    stagingDir: "ui-rebuild/overview",
  },
  {
    id: "calendar",
    route: "/appointments/calendar",
    label: "Calendar",
    screenshot: "ui-rebuild/references/calendar.jpg",
    stagingDir: "ui-rebuild/calendar",
  },
  {
    id: "appointment-types",
    route: "/appointments/types",
    label: "Appointment Types",
    screenshot: "ui-rebuild/references/appointment-types.jpg",
    stagingDir: "ui-rebuild/appointment-types",
  },
  {
    id: "availability",
    route: "/appointments/availability",
    label: "Availability",
    screenshot: "ui-rebuild/references/availability.jpg",
    stagingDir: "ui-rebuild/availability",
  },
  {
    id: "reminder-settings",
    route: "/appointments/reminders",
    label: "Reminder Settings",
    screenshot: "ui-rebuild/references/reminder-settings.jpg",
    stagingDir: "ui-rebuild/reminder-settings",
  },
  {
    id: "booking",
    route: "/appointments/booking",
    label: "Booking",
    screenshot: "ui-rebuild/references/booking.jpg",
    stagingDir: "ui-rebuild/booking",
  },
  {
    id: "get-started",
    route: "/appointments/setup",
    label: "Get Started",
    screenshot: "ui-rebuild/references/get-started.jpg",
    stagingDir: "ui-rebuild/get-started",
  },
];

function loadState(): RebuildState {
  if (!existsSync(STATE_PATH)) {
    return {
      updatedAt: new Date().toISOString(),
      concurrency: 7,
      staggerMs: 5000,
      jobs: JOBS.map((j) => ({ ...j, status: "pending" as const })),
    };
  }
  const raw = JSON.parse(readFileSync(STATE_PATH, "utf8")) as RebuildState;
  const byId = new Map(raw.jobs.map((j) => [j.id, j]));
  raw.jobs = JOBS.map((j) => {
    const existing = byId.get(j.id);
    if (existing && existing.status === "complete" && existing.sessionId) return existing;
    return { ...j, status: "pending" as const };
  });
  return raw;
}

function saveState(state: RebuildState): void {
  state.updatedAt = new Date().toISOString();
  mkdirSync(UI_REBUILD_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function copyDir(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else cpSync(from, to);
  }
}

function mirrorToStaging(job: RebuildJob, sessionId: string): void {
  const draftDir = draftDirForSession(sessionId, job.route);
  const staging = join(REPO_ROOT, job.stagingDir, sessionId);
  if (!existsSync(draftDir)) {
    throw new Error(`Draft dir missing: ${draftDir}`);
  }
  copyDir(draftDir, staging);
  writeFileSync(
    join(REPO_ROOT, job.stagingDir, "LATEST.json"),
    JSON.stringify({ sessionId, route: job.route, savedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
  console.log(`  saved → ${staging}`);
}

function buildOptions(job: RebuildJob): CliOptions {
  const screenshotAbs = join(REPO_ROOT, job.screenshot);
  if (!existsSync(screenshotAbs)) {
    throw new Error(`Screenshot missing: ${screenshotAbs}`);
  }
  return {
    mode: "generate",
    target: job.route,
    referenceImages: [job.screenshot],
    referenceVideos: [],
    referenceUrls: [],
    referenceNames: [],
    referenceVideoNames: [],
    referenceImageNames: [],
    currentImages: [],
    currentVideos: [],
    captureCurrent: false,
    captureScreenshots: false,
    captureVideo: false,
    referenceDepth: "page",
    planOnly: true,
    apply: false,
    dryRun: false,
    analyzeOnly: false,
    approve: false,
    integrate: false,
    revise: false,
    complete: false,
    baseUrl: process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000",
    viewports: ["desktop"],
    maxPasses: 0,
    reasoningEffort: "low",
    instruction: `${RECREATION_INSTRUCTION}\n\nPage: ${job.label}\nRoute: ${job.route}`,
  };
}

async function runOneJob(job: RebuildJob, index: number, total: number, state: RebuildState): Promise<void> {
  // Batch recreation: skip per-session preview server (port 5174 collisions when concurrent).
  process.env.KIMI_SKIP_PREVIEW = "1";

  const row = state.jobs.find((j) => j.id === job.id)!;
  row.status = "running";
  row.startedAt = new Date().toISOString();
  row.error = undefined;
  saveState(state);

  console.log(`\n[${index + 1}/${total}] ${job.label} → ${job.route}`);
  const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });

  try {
    const result = await runKimiCommand(provider, buildOptions(job));
    mirrorToStaging(job, result.sessionId);
    row.status = "complete";
    row.sessionId = result.sessionId;
    row.completedAt = new Date().toISOString();
    console.log(`✓ ${job.label} (${result.fileCount} files) session=${result.sessionId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    row.status = "failed";
    row.error = message;
    row.completedAt = new Date().toISOString();
    console.error(`✗ ${job.label}: ${message}`);
  }
  saveState(state);
}

async function cmdRecreate(args: string[]): Promise<void> {
  const force = args.includes("--force");
  const concurrency = Number(args.find((a) => a.startsWith("--concurrency="))?.split("=")[1] || 7);
  const staggerMs = Number(args.find((a) => a.startsWith("--stagger-ms="))?.split("=")[1] || 5000);
  const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];

  const state = loadState();
  if (force) {
    state.jobs = JOBS.map((j) => ({ ...j, status: "pending" as const }));
  }
  state.concurrency = concurrency;
  state.staggerMs = staggerMs;
  saveState(state);

  const pending = state.jobs.filter(
    (j) => (force || j.status !== "complete") && (!only || j.id === only || j.route.includes(only)),
  );

  if (pending.length === 0) {
    console.log("No pending jobs.");
    cmdStatus();
    return;
  }

  console.log(`\nAppointments UI rebuild — Kimi Mode 1 recreation`);
  console.log(`Jobs: ${pending.length} | concurrency=${concurrency} | stagger=${staggerMs}ms\n`);

  let nextLaunchAt = Date.now();
  let cursor = 0;
  let active = 0;
  let done = 0;
  const total = pending.length;

  await new Promise<void>((resolve) => {
    const pump = (): void => {
      while (active < concurrency && cursor < total) {
        const job = pending[cursor++];
        active++;
        const launch = async (): Promise<void> => {
          const wait = Math.max(0, nextLaunchAt - Date.now());
          if (wait > 0) await sleep(wait);
          nextLaunchAt = Date.now() + staggerMs;
          try {
            await runOneJob(job, cursor - 1, total, state);
          } finally {
            active--;
            done++;
            if (done >= total && active === 0) resolve();
            else pump();
          }
        };
        void launch();
      }
    };
    pump();
  });

  console.log("\nRecreation batch finished.");
  cmdStatus();
}

function cmdStatus(): void {
  const state = loadState();
  console.log("\nPAGE                     RECREATED   SAVED   SESSION");
  for (const job of state.jobs) {
    const recreated = job.status === "complete" ? "YES" : job.status === "failed" ? "FAIL" : "NO";
    const saved =
      job.sessionId && existsSync(join(REPO_ROOT, job.stagingDir, job.sessionId)) ? "YES" : "NO";
    console.log(
      `${job.label.padEnd(24)} ${recreated.padEnd(11)} ${saved.padEnd(7)} ${job.sessionId ?? "—"}`,
    );
    if (job.error) console.log(`  error: ${job.error}`);
  }
  const done = state.jobs.filter((j) => j.status === "complete").length;
  console.log(`\n${done}/${state.jobs.length} recreated\n`);
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "recreate":
      await cmdRecreate(args);
      break;
    case "status":
      cmdStatus();
      break;
    default:
      console.log(`Usage: npx tsx scripts/appointments-ui-rebuild.ts recreate|status [--force]`);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
