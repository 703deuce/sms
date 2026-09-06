/**
 * Kimi Mode 4 batch orchestrator — concurrent approved-page rebuilds.
 *
 * Extends Mode 1 (runKimiCommand) with full standards + Page Contract + art direction.
 * Cursor orchestrates; Kimi generates. Output is integrated into production routes.
 *
 *   npm run ui:kimi-mode4 -- --status
 *   npm run ui:kimi-mode4 -- --stage golden
 *   npm run ui:kimi-mode4 -- --stage bulk --concurrency 10 --stagger-ms 5000
 *   npm run ui:kimi-mode4 -- --only appointments-calendar
 *   npm run ui:kimi-mode4 -- --contract-only --target /appointments/calendar
 *   npm run ui:kimi-mode4 -- --sync-manifest
 *
 * Env: MAX_CONCURRENT_KIMI_MODE4_JOBS (default 10), KIMI_MODE4_STAGGER_MS (default 5000)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { auditSandboxCompleteness } from "./kimi-completeness";
import { KimiVisionProvider } from "./kimi-client";
import { runKimiCommand } from "./kimi-command";
import {
  KIMI_MODE4_SYSTEM_PREFIX,
  UI_AGENT_DIR,
  ensureUiAgentDirs,
} from "./config";
import { log } from "./logger";
import { buildPageContract } from "./mode4-page-contract";
import {
  type Mode4ManifestEntry,
  type Mode4Stage,
  buildMode4Manifest,
  loadMode4Manifest,
  saveMode4Manifest,
} from "./mode4-manifest";
import {
  MODE4_ART_DIRECTION_VIDEOS,
  formatStandardsForKimi,
  loadStandardsPack,
  writeStandardsPackArtifact,
} from "./mode4-standards-pack";
import type { CliOptions } from "./types";

const MODE4_DIR = join(UI_AGENT_DIR, "mode4");
const STATE_PATH = join(MODE4_DIR, "batch-state.json");

export type Mode4JobState = {
  id: string;
  route: string;
  canonicalPath: string;
  stage: Mode4Stage;
  status: "pending" | "running" | "complete" | "failed" | "skipped" | "blocked";
  sessionId?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  accepted?: boolean;
  requiredFeaturesPreserved?: boolean;
  sharedComponentsUsed?: string[];
  backendHooksPreserved?: boolean;
  remainingBackendWiring?: string[];
  potentialConflict?: string;
  reworkReason?: string;
};

export type Mode4BatchState = {
  updatedAt: string;
  concurrency: number;
  staggerMs: number;
  jobs: Mode4JobState[];
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

function loadState(): Mode4BatchState {
  if (!existsSync(STATE_PATH)) {
    const manifest = loadMode4Manifest();
    return {
      updatedAt: new Date().toISOString(),
      concurrency: manifest.maxConcurrentJobs,
      staggerMs: manifest.staggerMs,
      jobs: manifest.entries
        .filter((e) => e.route !== "__foundation__")
        .map((e) => ({
          id: e.id,
          route: e.route,
          canonicalPath: e.canonicalPath,
          stage: e.stage,
          status: "pending",
        })),
    };
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf8")) as Mode4BatchState;
}

function saveState(state: Mode4BatchState): void {
  mkdirSync(MODE4_DIR, { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

async function updateJob(id: string, patch: Partial<Mode4JobState>): Promise<void> {
  await withStateLock(() => {
    const state = loadState();
    const idx = state.jobs.findIndex((j) => j.id === id);
    if (idx < 0) return;
    state.jobs[idx] = { ...state.jobs[idx], ...patch };
    saveState(state);
  });
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

function artDirectionVideoName(entry: Mode4ManifestEntry): string {
  if (entry.artDirection === "golden") {
    return MODE4_ART_DIRECTION_VIDEOS.campaign;
  }
  return MODE4_ART_DIRECTION_VIDEOS[entry.artDirection];
}

function buildMode4Instruction(entry: Mode4ManifestEntry): string {
  // FULL originals — no truncation. Preflight fails if any doc is truncated.
  const standards = formatStandardsForKimi(loadStandardsPack());
  const contract = buildPageContract({ id: entry.id });
  return [
    KIMI_MODE4_SYSTEM_PREFIX,
    "",
    "AUTHORITY ORDER (mandatory):",
    "1 Product scope/domain + approved page/feature specs",
    "2 Governance",
    "3 Foundational guides (HCD, IA, page architecture, visual system)",
    "4 Formal standards #1–#11",
    "5 Runtime/backend requirements (Page Contract + existing code)",
    "6 Golden screens (after Stage E)",
    "7 Campaign/Inbox art direction",
    "8 Old UI appearance (functionality evidence only — not visual authority)",
    "",
    "CURRENT UI RULE: Existing code preserves approved behavior and backend contracts only.",
    "Do NOT preserve incorrect placement, inconsistent patterns, obsolete legacy features, or old architecture.",
    "",
    "PAGE CONTRACT (supplemental — does NOT replace master specs above):",
    contract,
    "",
    "FULL GOVERNING STANDARDS PACK:",
    standards,
    "",
    `TARGET: ${entry.canonicalPath} (${entry.route})`,
    `ARCHETYPE: ${entry.archetype}`,
    "",
    "INTEGRATION DIRECTIVE:",
    "- Generate production-ready UI that Cursor will wire into the actual route.",
    "- Preserve API hooks, route params, mutations, permissions, and real state sources from existing code.",
    "- Reuse shared shell (sidebar/header) — do not reinvent global navigation.",
    "- After golden screens exist, match their visual rhythm, spacing, density, and component treatment.",
    "",
    "ART DIRECTION:",
    entry.artDirection === "inbox"
      ? "Use Inbox reference video for polish level only — Transovo Messages IA and features govern structure."
      : entry.artDirection === "workflows"
        ? "Use Workflows reference video for builder polish only — Transovo Automations IA governs structure."
        : "Use Campaign reference video for polish level only — Transovo product architecture governs structure.",
  ].join("\n");
}

function buildKimiOptions(entry: Mode4ManifestEntry, overrides: Partial<CliOptions> = {}): CliOptions {
  const videoName = artDirectionVideoName(entry);
  return {
    target: entry.route,
    referenceImages: [],
    referenceVideos: [],
    referenceUrls: [],
    referenceNames: [],
    referenceVideoNames: [videoName],
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
    walkthrough: false,
    baseUrl: process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000",
    viewports: ["desktop"],
    maxPasses: 1,
    reasoningEffort: "low",
    instruction: buildMode4Instruction(entry),
    ...overrides,
  };
}

async function runOneJob(
  entry: Mode4ManifestEntry,
  jobIndex: number,
  total: number,
  skipCompletePass: boolean,
): Promise<void> {
  await updateJob(entry.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    error: undefined,
  });

  console.log(`\n[Mode4 ${jobIndex + 1}/${total}] ${entry.canonicalPath}`);
  console.log(`  route: ${entry.route}`);
  console.log(`  archetype: ${entry.archetype} | stage: ${entry.stage}`);

  const provider = await KimiVisionProvider.createValidated({ reasoningEffort: "low" });

  try {
    const sessionDirPath = join(UI_AGENT_DIR, "sessions");
    writeStandardsPackArtifact(join(sessionDirPath, "..", "mode4", "last-job-standards"), loadStandardsPack());
    const result = await runKimiCommand(provider, buildKimiOptions(entry));
    if (!skipCompletePass) {
      const gaps = auditSandboxCompleteness(result.sessionId, entry.route);
      if (!gaps.complete) {
        console.log(
          `  completeness pass (${gaps.gaps.filter((g) => g.severity === "required").length} required gap(s))…`,
        );
        await runKimiCommand(
          provider,
          buildKimiOptions(entry, {
            sessionId: result.sessionId,
            complete: true,
            maxPasses: 0,
          }),
        );
      }
    }
    await updateJob(entry.id, {
      status: "complete",
      sessionId: result.sessionId,
      completedAt: new Date().toISOString(),
      accepted: false,
      requiredFeaturesPreserved: undefined,
      backendHooksPreserved: undefined,
    });
    log("mode4 complete", `${entry.route} → ${result.sessionId}`);
    console.log(`✓ ${entry.canonicalPath} → session ${result.sessionId}`);
    console.log(`  Cursor: static review per Page Contract, then integrate to production route.`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateJob(entry.id, {
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
    });
    console.error(`✗ ${entry.canonicalPath}: ${message}`);
  }
}

async function runConcurrentBatch(
  entries: Mode4ManifestEntry[],
  concurrency: number,
  staggerMs: number,
  skipCompletePass: boolean,
): Promise<void> {
  let nextLaunchAt = Date.now();
  let launchCursor = 0;
  let active = 0;
  let done = 0;
  const total = entries.length;

  console.log(
    `\nMode 4 batch: ${total} page(s) | concurrency=${concurrency} | stagger=${staggerMs}ms\n`,
  );

  await new Promise<void>((resolve) => {
    const pump = (): void => {
      while (active < concurrency && launchCursor < total) {
        const entry = entries[launchCursor++];
        active++;

        const launch = async (): Promise<void> => {
          const wait = Math.max(0, nextLaunchAt - Date.now());
          if (wait > 0) await sleep(wait);
          nextLaunchAt = Date.now() + staggerMs;
          try {
            await runOneJob(entry, launchCursor - 1, total, skipCompletePass);
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
  const running = state.jobs.filter((j) => j.status === "running").length;
  const complete = state.jobs.filter((j) => j.status === "complete").length;
  const failed = state.jobs.filter((j) => j.status === "failed").length;
  console.log("\nKimi Mode 4 — Transovo production rebuild\n");
  console.log(`State: ${STATE_PATH}`);
  console.log(`Concurrency: ${state.concurrency} | Stagger: ${state.staggerMs}ms`);
  console.log(`Running: ${running} | Complete: ${complete} | Failed: ${failed}\n`);
  for (const job of state.jobs) {
    const mark =
      job.status === "complete"
        ? "✓"
        : job.status === "failed"
          ? "✗"
          : job.status === "running"
            ? "…"
            : job.status === "blocked"
              ? "!"
              : "○";
    console.log(`${mark} [${job.stage}] ${job.canonicalPath}`);
    console.log(`    id: ${job.id} | route: ${job.route}`);
    if (job.sessionId) console.log(`    session: ${job.sessionId}`);
    if (job.error) console.log(`    error: ${job.error}`);
    if (job.reworkReason) console.log(`    rework: ${job.reworkReason}`);
    console.log("");
  }
  console.log(`${complete}/${state.jobs.length} complete\n`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  ensureUiAgentDirs();

  if (args.includes("--sync-manifest")) {
    const manifest = buildMode4Manifest();
    saveMode4Manifest(manifest);
    console.log(`Synced manifest → .ui-agent/mode4/rebuild-manifest.json (${manifest.entries.length} entries)`);
    return;
  }

  const contractOnly = args.includes("--contract-only");
  const target = parseArg(args, "--target");
  const only = parseArg(args, "--only");
  if (contractOnly && (target || only)) {
    const contract = buildPageContract({
      route: target,
      id: only,
      includeStandards: args.includes("--with-standards"),
    });
    console.log(contract);
    return;
  }

  const manifest = loadMode4Manifest();
  let state = loadState();

  // Merge new manifest entries into state
  const byId = new Map(state.jobs.map((j) => [j.id, j]));
  state.jobs = manifest.entries
    .filter((e) => e.route !== "__foundation__")
    .map((e) => {
      const existing = byId.get(e.id);
      if (existing) return { ...existing, route: e.route, canonicalPath: e.canonicalPath, stage: e.stage };
      return {
        id: e.id,
        route: e.route,
        canonicalPath: e.canonicalPath,
        stage: e.stage,
        status: "pending" as const,
      };
    });
  saveState(state);

  if (args.includes("--status")) {
    printStatus(loadState());
    return;
  }

  const stageFilter = parseArg(args, "--stage") as Mode4Stage | undefined;
  const foundation = manifest.entries.find((e) => e.stage === "foundations");
  const force = args.includes("--force");
  const skipCompletePass = args.includes("--no-complete-pass");
  const concurrency = Math.max(
    1,
    Number(parseArg(args, "--concurrency") || manifest.maxConcurrentJobs || 10),
  );
  const staggerMs = Math.max(0, Number(parseArg(args, "--stagger-ms") || manifest.staggerMs || 5_000));

  let entries = manifest.entries.filter((e) => e.route !== "__foundation__");
  if (stageFilter) entries = entries.filter((e) => e.stage === stageFilter);
  if (only) {
    entries = entries.filter(
      (e) => e.id === only || e.route.includes(only) || e.canonicalPath.toLowerCase().includes(only.toLowerCase()),
    );
    if (entries.length === 0) throw new Error(`No manifest entry matches --only ${only}`);
  }

  const jobStates = loadState().jobs;
  const pendingEntries = entries.filter((e) => {
    const job = jobStates.find((j) => j.id === e.id);
    if (!job) return true;
    if (force) return true;
    return job.status === "pending" || job.status === "failed" || job.status === "running";
  });

  if (pendingEntries.length === 0) {
    console.log("\nNothing pending.\n");
    printStatus(loadState());
    return;
  }

  // Stage D — Foundations: Cursor-orchestrated serial shell work (not concurrent Kimi page jobs)
  if (foundation && (!stageFilter || stageFilter === "foundations") && !only) {
    console.log("\n=== Stage D: Foundations (serial — Cursor orchestrates) ===\n");
    console.log("Run shared foundation work BEFORE bulk page jobs:");
    console.log("  1. npm run ui:kimi-sidebar   (canonical sidebar from reference video)");
    console.log("  2. Wire tokens, header, page-header, shared table/form/modal patterns");
    console.log("  3. Do NOT run foundation concurrently with page jobs.\n");
    if (stageFilter === "foundations") return;
  }

  state = loadState();
  state.concurrency = Math.min(concurrency, pendingEntries.length);
  state.staggerMs = staggerMs;
  saveState(state);

  const runnable = pendingEntries.filter((e) => e.stage !== "foundations");
  if (runnable.length === 0) {
    printStatus(loadState());
    return;
  }

  const effectiveConcurrency =
    stageFilter === "golden" ? Math.min(2, concurrency) : Math.min(concurrency, runnable.length);

  await runConcurrentBatch(runnable, effectiveConcurrency, staggerMs, skipCompletePass);
  printStatus(loadState());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
