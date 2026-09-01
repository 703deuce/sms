/**
 * Parallel Kimi polish from pre-captured screenshots (no walkthrough, no reference video).
 *
 *   npm run ui:kimi-screenshot-batch -- --concurrency 50
 *   npm run ui:kimi-screenshot-batch -- --jobs .ui-agent/batch/screenshot-polish-jobs.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KimiVisionProvider } from "./kimi-client";
import { runKimiPolishCommand } from "./kimi-polish";
import { UI_AGENT_DIR, ensureUiAgentDirs } from "./config";
import type { CliOptions } from "./types";

export type ScreenshotPolishJob = {
  id: string;
  path: string;
  target: string;
  screenshot: string;
  instruction?: string;
};

export type ScreenshotPolishBatch = {
  instruction: string;
  jobs: ScreenshotPolishJob[];
};

const DEFAULT_INSTRUCTION =
  "Polish this UI: spacing, hierarchy, surfaces, tables, buttons, status pills. Keep all hooks, API calls, and navigation exactly as they are.";

const DEFAULT_JOBS_PATH = join(UI_AGENT_DIR, "batch", "screenshot-polish-jobs.json");

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

function buildOptions(job: ScreenshotPolishJob, instruction: string): CliOptions {
  return {
    mode: "polish",
    target: job.target,
    referenceImages: [],
    referenceVideos: [],
    referenceUrls: [],
    referenceNames: [],
    referenceVideoNames: [],
    referenceImageNames: [],
    currentImages: [job.screenshot],
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
    skipAutoReference: true,
    baseUrl: process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000",
    viewports: ["desktop"],
    maxPasses: 1,
    reasoningEffort: "low",
    instruction: job.instruction || instruction,
  };
}

async function runOne(
  job: ScreenshotPolishJob,
  instruction: string,
  index: number,
  total: number,
): Promise<{ id: string; ok: boolean; sessionId?: string; error?: string; files?: number }> {
  const started = Date.now();
  console.log(`[${index + 1}/${total}] start ${job.id} → ${job.target}`);
  try {
    const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });
    const result = await runKimiPolishCommand(provider, buildOptions(job, instruction));
    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`[${index + 1}/${total}] ✓ ${job.id} (${elapsed}s) → ${result.touchedFiles.length} files`);
    return { id: job.id, ok: true, sessionId: result.sessionId, files: result.touchedFiles.length };
  } catch (err) {
    const elapsed = Math.round((Date.now() - started) / 1000);
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${index + 1}/${total}] ✗ ${job.id} (${elapsed}s): ${message}`);
    return { id: job.id, ok: false, error: message };
  }
}

async function runConcurrentBatch(
  jobs: ScreenshotPolishJob[],
  instruction: string,
  concurrency: number,
  staggerMs: number,
): Promise<void> {
  let nextLaunchAt = Date.now();
  let launchCursor = 0;
  let active = 0;
  let done = 0;
  const total = jobs.length;
  const results: Array<{ id: string; ok: boolean; sessionId?: string; error?: string; files?: number }> = [];

  await new Promise<void>((resolve) => {
    const pump = (): void => {
      while (active < concurrency && launchCursor < total) {
        const job = jobs[launchCursor++];
        active++;
        const launch = async (): Promise<void> => {
          const wait = Math.max(0, nextLaunchAt - Date.now());
          if (wait > 0) await sleep(wait);
          nextLaunchAt = Date.now() + staggerMs;
          try {
            results.push(await runOne(job, instruction, launchCursor - 1, total));
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

  const ok = results.filter((r) => r.ok).length;
  console.log(`\nDone: ${ok}/${total} succeeded\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jobsPath = parseArg(args, "--jobs") || DEFAULT_JOBS_PATH;
  const concurrency = Math.max(1, Number(parseArg(args, "--concurrency") || process.env.KIMI_POLISH_CONCURRENCY || 50));
  const staggerMs = Math.max(0, Number(parseArg(args, "--stagger-ms") || process.env.KIMI_POLISH_STAGGER_MS || 0));

  if (!existsSync(jobsPath)) {
    throw new Error(`Jobs file not found: ${jobsPath}`);
  }

  const batch = JSON.parse(readFileSync(jobsPath, "utf8")) as ScreenshotPolishBatch;
  const instruction = batch.instruction || DEFAULT_INSTRUCTION;
  const jobs = batch.jobs.filter((j) => existsSync(j.screenshot));

  if (jobs.length === 0) throw new Error("No jobs with existing screenshots");

  ensureUiAgentDirs();
  mkdirSync(join(UI_AGENT_DIR, "batch"), { recursive: true });

  console.log(`\nScreenshot polish batch: ${jobs.length} job(s) | concurrency=${concurrency}\n`);
  const started = Date.now();
  await runConcurrentBatch(jobs, instruction, Math.min(concurrency, jobs.length), staggerMs);
  const elapsed = Math.round((Date.now() - started) / 1000);
  console.log(`Total wall time: ${elapsed}s`);

  writeFileSync(
    join(UI_AGENT_DIR, "batch", "screenshot-polish-last-run.json"),
    JSON.stringify({ at: new Date().toISOString(), elapsedSec: elapsed, jobs: jobs.map((j) => j.id) }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
