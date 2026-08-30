/**
 * Batch-generate Kimi sandbox pages for every video in .ui-agent/references.json
 * that has a transovoRoute. Uses K3 + reasoning_effort=low (default).
 *
 *   npm run ui:kimi-batch
 *   npm run ui:kimi-batch -- --force
 *   npm run ui:kimi-batch -- --only "Navigating the SlickText Inbox..."
 *   npm run ui:kimi-batch -- --status
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
};

export type BatchState = {
  updatedAt: string;
  reasoningEffort: string;
  jobs: BatchJobState[];
};

function loadState(): BatchState {
  if (!existsSync(STATE_PATH)) {
    return { updatedAt: new Date().toISOString(), reasoningEffort: "low", jobs: [] };
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
    if (existing) return { ...existing, route };
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
  console.log("\nKimi batch — SlickText pages (reasoning_effort=low)\n");
  console.log(`State: ${STATE_PATH}\n`);
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const statusOnly = args.includes("--status");
  const onlyIdx = args.indexOf("--only");
  const onlyName = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;

  ensureUiAgentDirs();
  let state = mergeJobs(loadState(), listVideoJobs());

  if (statusOnly) {
    printStatus(state);
    return;
  }

  const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });
  let jobs = state.jobs;
  if (onlyName) {
    jobs = jobs.filter((j) => j.videoName === onlyName || j.videoName.includes(onlyName));
    if (jobs.length === 0) throw new Error(`No batch job matches --only ${onlyName}`);
  }

  const pending = jobs.filter((j) => {
    if (j.status === "complete" && !force) return false;
    if (j.status === "skipped") return false;
    return true;
  });

  console.log(`\nKimi batch: ${pending.length} video(s) to generate (reasoning_effort=low)\n`);

  for (let i = 0; i < pending.length; i++) {
    const job = pending[i];
    const idx = state.jobs.findIndex((j) => j.videoName === job.videoName);
    if (idx < 0) continue;

    console.log(`\n[${i + 1}/${pending.length}] ${job.route}`);
    console.log(`  video: ${job.videoName}\n`);

    state.jobs[idx] = {
      ...job,
      status: "running",
      startedAt: new Date().toISOString(),
      error: undefined,
    };
    saveState(state);

    const options: CliOptions = {
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
    };

    try {
      const result = await runKimiCommand(provider, {
        ...options,
        instruction: options.instruction || KIMI_BATCH_PAGE_INSTRUCTION,
      });

      state.jobs[idx] = {
        ...state.jobs[idx],
        status: "complete",
        sessionId: result.sessionId,
        completedAt: new Date().toISOString(),
      };
      log("batch complete", `${job.route} → ${result.sessionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      state.jobs[idx] = {
        ...state.jobs[idx],
        status: "failed",
        error: message,
        completedAt: new Date().toISOString(),
      };
      log("batch failed", `${job.route}: ${message}`);
      console.error(`FAILED ${job.route}: ${message}`);
    }

    saveState(state);
  }

  printStatus(state);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
