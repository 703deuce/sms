/**
 * Kimi Mode 4 — UI Completion & Polish (gap-fill repass).
 *
 * Surface-agnostic: requires --only <manifestId> for each job, or --golden-batch for concurrent golden gap-fill.
 * Golden batch ordering lives in .ui-agent/mode4/golden-completion-order.json (orchestration only).
 *
 *   npm run ui:kimi-mode4-completion -- --status
 *   npm run ui:kimi-mode4-completion -- --only appointments-calendar
 *   npm run ui:kimi-mode4-completion -- --golden-batch --concurrency 5
 *   npm run ui:kimi-mode4-completion -- --bulk-batch --concurrency 30
 *   npm run ui:kimi-mode4-completion -- --print-instruction --only booking-types
 *   npm run ui:kimi-mode4-completion -- --gaps-file .ui-agent/mode4/gaps/calendar.json --only appointments-calendar
 *   npm run ui:kimi-mode4-completion -- --skip-screenshot --only home   (only if capture fails)
 *   npm run ui:kimi-mode4-completion -- --force --only appointments-calendar
 *
 * @see docs/TRANSOVO-KIMI-MODE-4-ORCHESTRATION.md § Stage G (golden gap-fill)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KimiVisionProvider } from "./kimi-client";
import { runKimiCommand } from "./kimi-command";
import { UI_AGENT_DIR, ensureUiAgentDirs } from "./config";
import { log } from "./logger";
import {
  buildMode4CompletionInstruction,
  resolveGapsForManifest,
} from "./mode4-completion";
import { loadGoldenCompletionOrder } from "./mode4-completion-config";
import { captureDraftScreenshot } from "./mode4-draft-screenshot";
import { getGoldenGapEntry, listAuditGapManifestIds } from "./mode4-golden-gaps";
import type { Mode4BatchState, Mode4JobState } from "./kimi-mode4-batch";
import { getManifestEntryById, loadMode4Manifest } from "./mode4-manifest";
import {
  assertKimiOutputPersisted,
  draftDirForSession,
  seedSandboxFromDraft,
} from "./kimi-persist";
import { buildProjectManifest } from "./project-context";
import { loadSession, saveSession } from "./session";
import type { CliOptions, UiAgentSession } from "./types";
import { generatedDirForSession } from "./generated-sandbox";

const STATE_PATH = join(UI_AGENT_DIR, "mode4", "batch-state.json");

function parseArg(args: string[], flag: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split("=").slice(1).join("=");
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return undefined;
}

function loadBatchState(): Mode4BatchState {
  if (!existsSync(STATE_PATH)) {
    throw new Error(`No batch state at ${STATE_PATH} — run first-pass generation first`);
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as Mode4BatchState;
}

function saveBatchState(state: Mode4BatchState): void {
  mkdirSync(join(UI_AGENT_DIR, "mode4"), { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

function ensureSessionForCompletion(sessionId: string, target: string): UiAgentSession {
  try {
    return loadSession(sessionId);
  } catch {
    const manifest = buildProjectManifest(target);
    const session: UiAgentSession = {
      id: sessionId,
      createdAt: new Date().toISOString(),
      target,
      instruction: "",
      referenceMedia: [],
      currentMedia: [],
      manifest,
      generatedDir: generatedDirForSession(sessionId),
      status: "ready",
    };
    saveSession(session);
    return session;
  }
}

function resolveManifestId(only: string): string {
  const manifest = loadMode4Manifest();
  const byId = manifest.entries.find((e) => e.id === only);
  if (byId) return byId.id;
  const byRoute = manifest.entries.find((e) => e.route.includes(only));
  if (byRoute) return byRoute.id;
  const byPath = manifest.entries.find((e) =>
    e.canonicalPath.toLowerCase().includes(only.toLowerCase()),
  );
  if (byPath) return byPath.id;
  const gapEntry = listAuditGapManifestIds()
    .map((id) => getGoldenGapEntry(id))
    .find((e) => e?.canonicalPath.toLowerCase().includes(only.toLowerCase()));
  if (gapEntry) return gapEntry.manifestId;
  throw new Error(`No manifest entry matches --only ${only}`);
}

function resolveJobDraft(job: Mode4JobState): { sessionId: string; draftPath: string } {
  if (!job.sessionId) {
    throw new Error(`${job.canonicalPath}: missing sessionId in batch state`);
  }
  const draftPath = job.draftPath ?? draftDirForSession(job.sessionId, job.route);
  if (!existsSync(draftPath)) {
    throw new Error(`Draft not found for ${job.canonicalPath}: ${draftPath}`);
  }
  return { sessionId: job.sessionId, draftPath };
}

async function runCompletionJob(input: {
  manifestId: string;
  job: Mode4JobState;
  gapsFile?: string;
  screenshotOverride?: string;
  skipScreenshot?: boolean;
  dryRun?: boolean;
}): Promise<void> {
  const { manifestId, job, gapsFile, screenshotOverride, skipScreenshot, dryRun } = input;
  const entry = getManifestEntryById(manifestId);
  if (!entry) throw new Error(`Unknown manifest id: ${manifestId}`);

  const gaps = resolveGapsForManifest(manifestId, gapsFile);
  const { sessionId, draftPath } = resolveJobDraft(job);

  let screenshotPath = screenshotOverride;
  let screenshotCaptureFailed = false;
  let screenshotError: string | undefined;

  if (!dryRun && !skipScreenshot && !screenshotOverride) {
    ensureSessionForCompletion(sessionId, entry.route);
    seedSandboxFromDraft(sessionId, draftPath);
    console.log(`  capturing CURRENT_RENDERED_DRAFT screenshot…`);
    const shot = await captureDraftScreenshot(sessionId, manifestId);
    if (shot.failed) {
      screenshotCaptureFailed = true;
      screenshotError = shot.error;
      console.warn(`  ⚠ screenshot capture failed: ${shot.error}`);
      console.warn(`  continuing with code-only baseline`);
    } else {
      screenshotPath = shot.path;
      console.log(`  screenshot: ${shot.path}`);
    }
  } else if (!dryRun) {
    ensureSessionForCompletion(sessionId, entry.route);
    seedSandboxFromDraft(sessionId, draftPath);
  }

  const instruction = buildMode4CompletionInstruction({
    entry,
    gaps,
    draftPath,
    screenshotPath,
    screenshotCaptureFailed,
    screenshotError,
  });

  if (dryRun) {
    console.log(instruction);
    return;
  }

  console.log(`\n[Completion] ${entry.canonicalPath}`);
  console.log(`  audit gap hints: ${gaps.length} (non-exhaustive)`);
  console.log(`  baseline: ${draftPath}`);
  console.log(`  session: ${sessionId}`);
  console.log(`  hierarchy: Preserve → Complete → Correct → Polish`);

  const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });

  const options: CliOptions = {
    target: entry.route,
    sessionId,
    completion: true,
    referenceImages: [],
    referenceVideos: [],
    referenceUrls: [],
    referenceNames: [],
    referenceVideoNames: [],
    referenceImageNames: [],
    currentImages: screenshotPath ? [screenshotPath] : [],
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
    walkthrough: false,
    baseUrl: process.env.UI_AGENT_BASE_URL?.trim() || "http://localhost:3000",
    viewports: ["desktop"],
    maxPasses: 0,
    reasoningEffort: "low",
    instruction,
  };

  await runKimiCommand(provider, options);

  const manifest = assertKimiOutputPersisted(sessionId, entry.route);
  log("mode4 completion", `${entry.route} → ${sessionId}`);
  console.log(`✓ Completion pass done → ${draftPath} (${manifest.persistedFiles.length} files)`);
  console.log(`  Next: run Blueprint Audit independently — completion does not self-accept.`);

  const state = loadBatchState();
  const idx = state.jobs.findIndex((j) => j.id === manifestId);
  if (idx >= 0) {
    state.jobs[idx] = {
      ...state.jobs[idx],
      draftPath,
      persistedFiles: manifest.persistedFiles.length,
      reworkReason: `completion pass (${new Date().toISOString()}) — re-audit required`,
      completedAt: new Date().toISOString(),
    };
    saveBatchState(state);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCompletionDone(job: Mode4JobState): boolean {
  return Boolean(job.reworkReason?.startsWith("completion pass"));
}

async function runConcurrentCompletionBatch(input: {
  manifestIds: string[];
  state: Mode4BatchState;
  concurrency: number;
  staggerMs: number;
  gapsFile?: string;
  screenshotOverride?: string;
  skipScreenshot?: boolean;
  force?: boolean;
  dryRun?: boolean;
}): Promise<void> {
  const {
    manifestIds,
    state,
    concurrency,
    staggerMs,
    gapsFile,
    screenshotOverride,
    skipScreenshot,
    force,
    dryRun,
  } = input;

  const runnable = manifestIds
    .map((id) => {
      const job = state.jobs.find((j) => j.id === id);
      if (!job) throw new Error(`No batch job for manifest id ${id}`);
      return { manifestId: id, job };
    })
    .filter(({ manifestId, job }) => {
      if (job.status !== "complete" && !force) {
        console.warn(`Skipping ${manifestId}: first-pass not complete (status=${job.status})`);
        return false;
      }
      if (isCompletionDone(job) && !force) {
        console.warn(`Skipping ${manifestId}: completion already run (use --force to re-run)`);
        return false;
      }
      return true;
    });

  if (runnable.length === 0) {
    console.log("No completion jobs to run.");
    return;
  }

  let nextLaunchAt = Date.now();
  let launchCursor = 0;
  let active = 0;
  let done = 0;
  const total = runnable.length;
  const effectiveConcurrency = Math.min(concurrency, total);

  console.log(
    `\nCompletion batch: ${total} surface(s) | concurrency=${effectiveConcurrency} | stagger=${staggerMs}ms`,
  );

  await new Promise<void>((resolve) => {
    const pump = (): void => {
      while (active < effectiveConcurrency && launchCursor < total) {
        const { manifestId, job } = runnable[launchCursor++];
        active++;

        const launch = async (): Promise<void> => {
          const wait = Math.max(0, nextLaunchAt - Date.now());
          if (wait > 0) await sleep(wait);
          nextLaunchAt = Date.now() + staggerMs;
          try {
            await runCompletionJob({
              manifestId,
              job,
              gapsFile,
              screenshotOverride,
              skipScreenshot,
              dryRun,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`✗ ${job.canonicalPath}: ${message}`);
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

function printStatus(state: Mode4BatchState): void {
  const order = loadGoldenCompletionOrder();
  console.log("\nKimi Mode 4 — UI Completion & Polish (surface-agnostic)\n");
  console.log(`Batch state: ${STATE_PATH}`);
  console.log(`Golden order config: .ui-agent/mode4/golden-completion-order.json\n`);
  console.log("Single: npm run ui:kimi-mode4-completion -- --only <manifestId>");
  console.log("Golden: npm run ui:kimi-mode4-completion -- --golden-batch --concurrency 5");
  console.log("Bulk:   npm run ui:kimi-mode4-completion -- --bulk-batch --concurrency 30\n");

  for (const id of order.manifestIds) {
    const gapEntry = getGoldenGapEntry(id);
    const job = state.jobs.find((j) => j.id === id);
    const hasDraft =
      job?.sessionId && existsSync(draftDirForSession(job.sessionId, job.route));
    const mark = hasDraft ? "○" : "✗";
    console.log(`${mark} ${gapEntry?.canonicalPath ?? job?.canonicalPath ?? id}`);
    if (gapEntry) {
      console.log(`    audit hints: ${gapEntry.gaps.length} | prior score: ~${gapEntry.blueprintScore}%`);
    }
    if (job?.sessionId) {
      const dp = job.draftPath ?? draftDirForSession(job.sessionId, job.route);
      if (existsSync(dp)) console.log(`    draft: ${dp}`);
    }
    if (job?.reworkReason) console.log(`    last: ${job.reworkReason}`);
    console.log("");
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  ensureUiAgentDirs();
  loadMode4Manifest();

  const state = loadBatchState();

  if (args.includes("--status")) {
    printStatus(state);
    return;
  }

  const gapsFile = parseArg(args, "--gaps-file");
  const screenshotOverride = parseArg(args, "--screenshot");
  const skipScreenshot = args.includes("--skip-screenshot");
  const printInstruction = args.includes("--print-instruction");
  const force = args.includes("--force");
  const goldenBatch = args.includes("--golden-batch");
  const bulkBatch = args.includes("--bulk-batch");
  const only = parseArg(args, "--only");
  const concurrency = Math.max(
    1,
    Number(
      parseArg(args, "--concurrency") ||
        (bulkBatch ? process.env.KIMI_MODE4_BULK_COMPLETION_CONCURRENCY : undefined) ||
        process.env.KIMI_MODE4_COMPLETION_CONCURRENCY ||
        (bulkBatch ? 30 : 5),
    ),
  );
  const staggerMs = Math.max(
    0,
    Number(parseArg(args, "--stagger-ms") || process.env.KIMI_MODE4_STAGGER_MS || 5_000),
  );

  if (goldenBatch || bulkBatch) {
    const manifestIds = only
      ? [resolveManifestId(only)]
      : bulkBatch
        ? state.jobs
            .filter((j) => j.stage === "bulk")
            .map((j) => j.id)
            .filter((id) => {
              const job = state.jobs.find((j) => j.id === id);
              return force || !isCompletionDone(job ?? { id, reworkReason: undefined } as Mode4JobState);
            })
        : loadGoldenCompletionOrder().manifestIds.filter((id) => {
            const job = state.jobs.find((j) => j.id === id);
            return force || !isCompletionDone(job ?? { id, reworkReason: undefined } as Mode4JobState);
          });

    console.log(
      bulkBatch
        ? `Bulk completion batch: ${manifestIds.length} surface(s) — screenshot baseline per job (no reference video)`
        : `Golden completion batch: ${manifestIds.length} surface(s)`,
    );

    await runConcurrentCompletionBatch({
      manifestIds,
      state,
      concurrency,
      staggerMs,
      gapsFile,
      screenshotOverride,
      skipScreenshot,
      force,
      dryRun: printInstruction,
    });

    if (!printInstruction) {
      printStatus(loadBatchState());
    }
    return;
  }

  if (!only) {
    console.error("Error: --only <manifestId>, --golden-batch, or --bulk-batch is required.");
    console.error("Example: npm run ui:kimi-mode4-completion -- --only appointments-calendar");
    console.error("Golden:  npm run ui:kimi-mode4-completion -- --golden-batch --concurrency 5");
    console.error("Bulk:    npm run ui:kimi-mode4-completion -- --bulk-batch --concurrency 30");
    console.error("Status:  npm run ui:kimi-mode4-completion -- --status");
    process.exit(1);
  }

  const manifestId = resolveManifestId(only);
  const job = state.jobs.find((j) => j.id === manifestId);
  if (!job) {
    throw new Error(`No batch job for manifest id ${manifestId}`);
  }
  if (job.status !== "complete" && !force) {
    throw new Error(
      `${job.canonicalPath}: first-pass not complete (status=${job.status}). Use --force to override.`,
    );
  }
  if (isCompletionDone(job) && !force && !printInstruction) {
    console.warn(`Note: completion already run for ${manifestId}. Use --force to re-run.`);
  }

  await runCompletionJob({
    manifestId,
    job,
    gapsFile,
    screenshotOverride,
    skipScreenshot,
    dryRun: printInstruction,
  });

  if (!printInstruction) {
    printStatus(loadBatchState());
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
