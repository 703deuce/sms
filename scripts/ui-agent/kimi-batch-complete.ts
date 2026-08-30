/**
 * Force Kimi completeness pass on every batch job (re-watch video, fill missing UI).
 *
 *   npm run ui:kimi-batch-complete
 *   npm run ui:kimi-batch-complete -- --only conversations
 *   npm run ui:kimi-batch-complete -- --skip automations --concurrency 5
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { KimiVisionProvider } from "./kimi-client";
import { runKimiCommand } from "./kimi-command";
import { auditSandboxCompleteness, printCompletenessReport } from "./kimi-completeness";
import { UI_AGENT_DIR, ensureUiAgentDirs } from "./config";
import type { BatchJobState, BatchState } from "./kimi-batch-pages";
import type { CliOptions } from "./types";

const STATE_PATH = join(UI_AGENT_DIR, "batch", "kimi-slicktext-pages.json");
const DEFAULT_CONCURRENCY = Number(process.env.KIMI_BATCH_CONCURRENCY || 5);
const DEFAULT_STAGGER_MS = Number(process.env.KIMI_BATCH_STAGGER_MS || 3_000);

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

function loadState(): BatchState {
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as BatchState;
}

function buildOptions(job: BatchJobState): CliOptions {
  return {
    sessionId: job.sessionId,
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
    complete: true,
    baseUrl: process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000",
    viewports: ["desktop"],
    maxPasses: 0,
    reasoningEffort: "low",
    instruction: "",
  };
}

async function runOne(
  job: BatchJobState,
  index: number,
  total: number,
): Promise<{ route: string; ok: boolean; error?: string }> {
  if (!job.sessionId) {
    return { route: job.route, ok: false, error: "no sessionId" };
  }
  if (!existsSync(join(UI_AGENT_DIR, "sessions", job.sessionId, "input.json"))) {
    return { route: job.route, ok: false, error: "missing session input.json" };
  }

  const before = auditSandboxCompleteness(job.sessionId, job.route);
  console.log(`\n[${index + 1}/${total}] ${job.route} (${job.sessionId})`);
  printCompletenessReport(before);

  const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });
  try {
    await runKimiCommand(provider, buildOptions(job));
    const after = auditSandboxCompleteness(job.sessionId, job.route);
    printCompletenessReport(after);
    return { route: job.route, ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${job.route}: ${message}`);
    return { route: job.route, ok: false, error: message };
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const only = parseArg(args, "--only");
  const skip = parseArg(args, "--skip");
  const concurrency = Math.max(1, Number(parseArg(args, "--concurrency") || DEFAULT_CONCURRENCY));
  const staggerMs = Math.max(0, Number(parseArg(args, "--stagger-ms") || DEFAULT_STAGGER_MS));

  ensureUiAgentDirs();
  const state = loadState();
  let jobs = state.jobs.filter((j) => j.status === "complete" && j.sessionId);

  if (only) {
    jobs = jobs.filter((j) => j.route.includes(only) || j.videoName.includes(only));
  }
  if (skip) {
    jobs = jobs.filter((j) => !j.route.includes(skip) && !j.videoName.includes(skip));
  }

  if (jobs.length === 0) {
    console.log("No batch jobs to complete.");
    return;
  }

  console.log(`\nKimi batch completeness: ${jobs.length} session(s) | concurrency=${concurrency}\n`);

  const results: Array<{ route: string; ok: boolean; error?: string }> = [];
  let nextLaunchAt = Date.now();
  let cursor = 0;
  let active = 0;

  await new Promise<void>((resolve) => {
    const pump = (): void => {
      while (active < concurrency && cursor < jobs.length) {
        const job = jobs[cursor++];
        active++;
        const idx = cursor - 1;

        void (async () => {
          const wait = Math.max(0, nextLaunchAt - Date.now());
          if (wait > 0) await sleep(wait);
          nextLaunchAt = Date.now() + staggerMs;
          try {
            results.push(await runOne(job, idx, jobs.length));
          } finally {
            active--;
            if (cursor >= jobs.length && active === 0) resolve();
            else pump();
          }
        })();
      }
    };
    pump();
  });

  const ok = results.filter((r) => r.ok).length;
  console.log(`\nDone: ${ok}/${results.length} completeness passes succeeded\n`);
  for (const r of results.filter((x) => !x.ok)) {
    console.log(`  ✗ ${r.route}: ${r.error}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
