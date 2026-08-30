/**
 * Batch-generate Kimi sandbox pages for every video in .ui-agent/references.json
 * that has a transovoRoute. Uses K3 + reasoning_effort=low (default).
 *
 * Runs jobs CONCURRENTLY with staggered launches (Kimi API supports multi-request
 * concurrency per account tier — default 3 parallel, 10s between starts).
 *
 *   npm run ui:kimi-batch
 *   npm run ui:kimi-batch -- --concurrency 5 --stagger-ms 10000
 *   npm run ui:kimi-batch -- --force
 *   npm run ui:kimi-batch -- --only "contacts"
 *   npm run ui:kimi-batch -- --status
 *
 * Env: KIMI_BATCH_CONCURRENCY, KIMI_BATCH_STAGGER_MS
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadReferencesManifest } from "@/lib/ui-agent/references-manifest";
import { KimiVisionProvider } from "./kimi-client";
import { runKimiCommand } from "./kimi-command";
import { KIMI_BATCH_PAGE_INSTRUCTION, UI_AGENT_DIR, ensureUiAgentDirs } from "./config";
import { log } from "./logger";
import type { CliOptions } from "./types";

const BATCH_DIR = join(UI_AGENT_DIR, "batch");
const STATE_PATH = join(BATCH_DIR, "kimi-slicktext-pages.json");

/** Tier 1+ Kimi accounts allow ~50 concurrent requests. Default 10; set KIMI_BATCH_CONCURRENCY=50 to max out. */
const DEFAULT_CONCURRENCY = Number(process.env.KIMI_BATCH_CONCURRENCY || 10);
/** Short stagger avoids RPM bursts; Tier 1 allows 200 RPM so 2s is plenty. */
const DEFAULT_STAGGER_MS = Number(process.env.KIMI_BATCH_STAGGER_MS || 2_000);

/** Inbox already approved-quality from benchmark B — skip unless --force */
const PRECOMPLETED: Record<string, string> = {
  "Navigating the SlickText Inbox SlickText Tutorials - SlickText (360p)":
    "2026-08-30T21-10-07-149Z-f62033-bench-B",
};

export type BatchJobState = {
  videoName: string;
  route: string;
  status: "pending" | "running" | "complete" | "failed" | "skipped";
  sessionId?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  pid?: number;
};

export type BatchState = {
  updatedAt: string;
  reasoningEffort: string;
  concurrency: number;
  staggerMs: number;
  jobs: BatchJobState[];
};

let stateLock: Promise<void> = Promise.resolve();

function withStateLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = stateLock.then(fn);
  stateLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function updateJob(
  videoName: string,
  patch: Partial<BatchJobState>,
): Promise<BatchState> {
  return withStateLock(() => {
    const current = loadState();
    const idx = current.jobs.findIndex((j) => j.videoName === videoName);
    if (idx < 0) return current;
    current.jobs[idx] = { ...current.jobs[idx], ...patch };
    saveState(current);
    return current;
  });
}

function loadState(): BatchState {
  if (!existsSync(STATE_PATH)) {
    return {
      updatedAt: new Date().toISOString(),
      reasoningEffort: "low",
      concurrency: DEFAULT_CONCURRENCY,
      staggerMs: DEFAULT_STAGGER_MS,
      jobs: [],
    };
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as BatchState;
}

function saveState(state: BatchState): void {
  mkdirSync(BATCH_DIR, { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function listVideoJobs(): Array<{ videoName: string; route: string }> {
  const manifest = loadReferencesManifest();
  return Object.entries(manifest)
    .filter(([, entry]) => entry.type === "video" && entry.transovoRoute)
    .map(([videoName, entry]) => ({ videoName, route: entry.transovoRoute! }))
    .sort((a, b) => a.route.localeCompare(b.route) || a.videoName.localeCompare(b.videoName));
}

function mergeJobs(state: BatchState, videos: Array<{ videoName: string; route: string }>): BatchState {
  const byVideo = new Map(state.jobs.map((j) => [j.videoName, j]));
  const jobs: BatchJobState[] = videos.map(({ videoName, route }) => {
    const existing = byVideo.get(videoName);
    if (existing) {
      // Recover interrupted runs from a killed batch orchestrator
      if (existing.status === "running" && !existing.sessionId) {
        return { ...existing, route, status: "pending", pid: undefined };
      }
      return { ...existing, route };
    }
    const pre = PRECOMPLETED[videoName];
    if (pre) {
      return {
        videoName,
        route,
        status: "complete",
        sessionId: pre,
        completedAt: new Date().toISOString(),
      };
    }
    return { videoName, route, status: "pending" };
  });
  return { ...state, jobs };
}

function printStatus(state: BatchState): void {
  const running = state.jobs.filter((j) => j.status === "running").length;
  console.log("\nKimi batch — SlickText pages (reasoning_effort=low)\n");
  console.log(`State: ${STATE_PATH}`);
  console.log(`Concurrency: ${state.concurrency ?? DEFAULT_CONCURRENCY} | Stagger: ${state.staggerMs ?? DEFAULT_STAGGER_MS}ms`);
  console.log(`Running now: ${running}\n`);
  for (const job of state.jobs) {
    const mark =
      job.status === "complete" ? "✓" : job.status === "failed" ? "✗" : job.status === "running" ? "…" : "○";
    console.log(`${mark} ${job.route}`);
    console.log(`    video: ${job.videoName}`);
    if (job.sessionId) console.log(`    session: ${job.sessionId}`);
    if (job.error) console.log(`    error: ${job.error}`);
    console.log("");
  }
  const done = state.jobs.filter((j) => j.status === "complete").length;
  console.log(`${done}/${state.jobs.length} complete\n`);
}

function parseArg(args: string[], flag: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildOptions(job: BatchJobState): CliOptions {
  return {
    target: job.route,
    referenceImages: [],
    referenceVideos: [],
    referenceUrls: [],
    referenceNames: [],
    referenceVideoNames: [job.videoName],
    referenceImageNames: [],
    currentImages: [],
    currentVideos: [],
    captureCurrent: false,
    captureScreenshots: true,
    captureVideo: false,
    referenceDepth: "page",
    planOnly: true,
    apply: false,
    dryRun: false,
    analyzeOnly: false,
    approve: false,
    integrate: false,
    revise: false,
    baseUrl: process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000",
    viewports: ["desktop"],
    maxPasses: 0,
    reasoningEffort: "low",
    instruction: KIMI_BATCH_PAGE_INSTRUCTION,
  };
}

async function runOneJob(
  job: BatchJobState,
  jobIndex: number,
  total: number,
): Promise<void> {
  await updateJob(job.videoName, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
    pid: process.pid,
  });

  console.log(`\n[launch ${jobIndex + 1}/${total}] ${job.route}`);
  console.log(`  video: ${job.videoName}`);

  const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });

  try {
    const result = await runKimiCommand(provider, buildOptions(job));
    await updateJob(job.videoName, {
      status: "complete",
      sessionId: result.sessionId,
      completedAt: new Date().toISOString(),
      pid: undefined,
    });
    log("batch complete", `${job.route} → ${result.sessionId}`);
    console.log(`✓ ${job.route} → ${result.sessionId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const is429 = /429|rate limit/i.test(message);
    await updateJob(job.videoName, {
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
      pid: undefined,
    });
    log("batch failed", `${job.route}: ${message}`);
    console.error(`✗ ${job.route}: ${message}${is429 ? " (rate limit — lower --concurrency)" : ""}`);
  }
}

async function runConcurrentBatch(
  state: BatchState,
  pending: BatchJobState[],
  concurrency: number,
  staggerMs: number,
): Promise<void> {
  let nextLaunchAt = Date.now();
  let launchCursor = 0;
  let active = 0;
  let done = 0;
  const total = pending.length;

  console.log(
    `\nKimi batch: ${total} video(s) | concurrency=${concurrency} | stagger=${staggerMs}ms\n` +
      `(Kimi API concurrency is per-account tier — Tier1≈50, Tier0≈1. Tune with --concurrency / KIMI_BATCH_CONCURRENCY)\n`,
  );

  await new Promise<void>((resolve) => {
    const pump = (): void => {
      while (active < concurrency && launchCursor < total) {
        const job = pending[launchCursor++];
        active++;

        const launch = async (): Promise<void> => {
          const wait = Math.max(0, nextLaunchAt - Date.now());
          if (wait > 0) await sleep(wait);
          nextLaunchAt = Date.now() + staggerMs;

          try {
            await runOneJob(job, launchCursor - 1, total);
          } finally {
            active--;
            done++;
            if (done >= total && active === 0) {
              resolve();
            } else {
              pump();
            }
          }
        };

        void launch();
      }
    };

    pump();
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const statusOnly = args.includes("--status");
  const onlyName = parseArg(args, "--only");
  const requestedConcurrency = Math.max(1, Number(parseArg(args, "--concurrency") || DEFAULT_CONCURRENCY));
  const staggerMs = Math.max(0, Number(parseArg(args, "--stagger-ms") || DEFAULT_STAGGER_MS));

  ensureUiAgentDirs();
  let state = mergeJobs(loadState(), listVideoJobs());

  // Mark auto-replies complete if it finished while sequential batch was running
  const autoRepliesSession = "2026-08-30T21-31-49-644Z-f833cc";
  const autoIdx = state.jobs.findIndex((j) => j.route === "/auto-replies");
  if (autoIdx >= 0 && existsSync(join(UI_AGENT_DIR, "generated", autoRepliesSession, "page.tsx"))) {
    state.jobs[autoIdx] = {
      ...state.jobs[autoIdx],
      status: "complete",
      sessionId: autoRepliesSession,
      completedAt: state.jobs[autoIdx].completedAt || new Date().toISOString(),
    };
    saveState(state);
  }

  if (statusOnly) {
    printStatus(state);
    return;
  }

  let jobs = state.jobs;
  if (onlyName) {
    jobs = jobs.filter((j) => j.videoName === onlyName || j.videoName.includes(onlyName));
    if (jobs.length === 0) throw new Error(`No batch job matches --only ${onlyName}`);
  }

  const pending = jobs.filter((j) => {
    if (j.status === "complete" && !force) return false;
    if (j.status === "skipped") return false;
    if (j.status === "running" && j.sessionId) return false;
    return true;
  });

  if (pending.length === 0) {
    console.log("\nNothing pending — all jobs complete.\n");
    printStatus(state);
    return;
  }

  const concurrency = Math.min(requestedConcurrency, pending.length);
  state.concurrency = concurrency;
  state.staggerMs = staggerMs;
  saveState(state);

  await runConcurrentBatch(state, pending, concurrency, staggerMs);
  printStatus(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
