/**
 * Concurrent Kimi POLISH runs for routes in polish-targets.ts that are not yet polished.
 *
 *   DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=$APP_URL npm run ui:kimi-batch-polish
 *   npm run ui:kimi-batch-polish -- --only contacts
 *   npm run ui:kimi-batch-polish -- --concurrency 7 --force
 *   npm run ui:kimi-batch-polish -- --status
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KimiVisionProvider } from "./kimi-client";
import { runKimiCommand } from "./kimi-command";
import { POLISH_TARGETS } from "./polish-targets";
import { UI_AGENT_DIR, ensureUiAgentDirs } from "./config";
import { log } from "./logger";
import type { CliOptions } from "./types";

const BATCH_DIR = join(UI_AGENT_DIR, "batch");
const STATE_PATH = join(BATCH_DIR, "kimi-polish-pages.json");

const DEFAULT_CONCURRENCY = Number(process.env.KIMI_POLISH_CONCURRENCY || 7);
const DEFAULT_STAGGER_MS = Number(process.env.KIMI_POLISH_STAGGER_MS || 3_000);

const POLISH_INSTRUCTION =
  "Match the SlickText reference video polish: spacing, hierarchy, surfaces, tables, buttons, pills, and phone previews. " +
  "Large visual changes are OK when the page does not yet match the reference. Preserve all hooks, APIs, and navigation wiring.";

/** Routes already polished in production (skip unless --force). */
const PRECOMPLETED_ROUTES = new Set([
  "/campaigns",
  "/conversations",
  "/automations",
  "/auto-replies",
]);

export type PolishJobState = {
  route: string;
  status: "pending" | "running" | "complete" | "failed";
  sessionId?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

export type PolishBatchState = {
  updatedAt: string;
  concurrency: number;
  staggerMs: number;
  jobs: PolishJobState[];
};

function loadState(): PolishBatchState {
  if (!existsSync(STATE_PATH)) {
    return {
      updatedAt: new Date().toISOString(),
      concurrency: DEFAULT_CONCURRENCY,
      staggerMs: DEFAULT_STAGGER_MS,
      jobs: [],
    };
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as PolishBatchState;
}

function saveState(state: PolishBatchState): void {
  mkdirSync(BATCH_DIR, { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function mergeJobs(state: PolishBatchState): PolishBatchState {
  const byRoute = new Map(state.jobs.map((j) => [j.route, j]));
  const jobs: PolishJobState[] = POLISH_TARGETS.map((t) => {
    const existing = byRoute.get(t.route);
    if (existing) {
      if (existing.status === "running" && !existing.sessionId) {
        return { ...existing, status: "pending" };
      }
      return existing;
    }
    if (PRECOMPLETED_ROUTES.has(t.route)) {
      return { route: t.route, status: "complete", completedAt: new Date().toISOString() };
    }
    return { route: t.route, status: "pending" };
  });
  return { ...state, jobs };
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

function buildOptions(route: string): CliOptions {
  return {
    mode: "polish",
    target: route,
    referenceImages: [],
    referenceVideos: [],
    referenceUrls: [],
    referenceNames: [],
    referenceVideoNames: [],
    referenceImageNames: [],
    currentImages: [],
    currentVideos: [],
    captureCurrent: true,
    captureScreenshots: true,
    captureVideo: false,
    walkthrough: true,
    referenceDepth: "page",
    planOnly: false,
    apply: true,
    dryRun: false,
    analyzeOnly: false,
    approve: false,
    integrate: false,
    revise: false,
    complete: false,
    baseUrl: process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000",
    viewports: ["desktop"],
    maxPasses: 1,
    reasoningEffort: "low",
    instruction: POLISH_INSTRUCTION,
  };
}

async function runOneJob(job: PolishJobState, index: number, total: number): Promise<void> {
  const state = loadState();
  const idx = state.jobs.findIndex((j) => j.route === job.route);
  if (idx >= 0) {
    state.jobs[idx] = { ...state.jobs[idx], status: "running", startedAt: new Date().toISOString(), error: undefined };
    saveState(state);
  }

  console.log(`\n[polish ${index + 1}/${total}] ${job.route}`);
  const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });

  try {
    const result = await runKimiCommand(provider, buildOptions(job.route));
    const next = loadState();
    const j = next.jobs.findIndex((x) => x.route === job.route);
    if (j >= 0) {
      next.jobs[j] = {
        ...next.jobs[j],
        status: "complete",
        sessionId: result.sessionId,
        completedAt: new Date().toISOString(),
      };
      saveState(next);
    }
    log("polish batch complete", `${job.route} → ${result.sessionId}`);
    console.log(`✓ ${job.route} → ${result.sessionId}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const next = loadState();
    const j = next.jobs.findIndex((x) => x.route === job.route);
    if (j >= 0) {
      next.jobs[j] = {
        ...next.jobs[j],
        status: "failed",
        error: message,
        completedAt: new Date().toISOString(),
      };
      saveState(next);
    }
    console.error(`✗ ${job.route}: ${message}`);
  }
}

async function runConcurrentBatch(
  pending: PolishJobState[],
  concurrency: number,
  staggerMs: number,
): Promise<void> {
  let nextLaunchAt = Date.now();
  let launchCursor = 0;
  let active = 0;
  let done = 0;
  const total = pending.length;

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
            if (done >= total && active === 0) resolve();
            else pump();
          }
        };
        void launch();
      }
    };
    pump();
  });
}

function printStatus(state: PolishBatchState): void {
  console.log("\nKimi POLISH batch\n");
  for (const job of state.jobs) {
    const mark =
      job.status === "complete" ? "✓" : job.status === "failed" ? "✗" : job.status === "running" ? "…" : "○";
    console.log(`${mark} ${job.route}${job.sessionId ? ` → ${job.sessionId}` : ""}`);
    if (job.error) console.log(`    ${job.error}`);
  }
  const done = state.jobs.filter((j) => j.status === "complete").length;
  console.log(`\n${done}/${state.jobs.length} complete\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const statusOnly = args.includes("--status");
  const only = parseArg(args, "--only");
  const concurrency = Math.max(1, Number(parseArg(args, "--concurrency") || DEFAULT_CONCURRENCY));
  const staggerMs = Math.max(0, Number(parseArg(args, "--stagger-ms") || DEFAULT_STAGGER_MS));

  ensureUiAgentDirs();
  let state = mergeJobs(loadState());

  if (statusOnly) {
    printStatus(state);
    return;
  }

  let jobs = state.jobs;
  if (only) {
    jobs = jobs.filter((j) => j.route.includes(only) || j.route === `/${only.replace(/^\//, "")}`);
    if (jobs.length === 0) throw new Error(`No polish job matches --only ${only}`);
  }

  const pending = jobs.filter((j) => {
    if (force) return j.status !== "complete" || PRECOMPLETED_ROUTES.has(j.route) === false;
    if (j.status === "failed" || j.status === "pending" || j.status === "running") return true;
    return false;
  });

  if (pending.length === 0) {
    console.log("\nNothing pending.\n");
    printStatus(state);
    return;
  }

  state.concurrency = Math.min(concurrency, pending.length);
  state.staggerMs = staggerMs;
  saveState(state);

  console.log(`\nPolish batch: ${pending.length} route(s) | concurrency=${state.concurrency}\n`);
  await runConcurrentBatch(pending, state.concurrency, staggerMs);
  printStatus(mergeJobs(loadState()));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
