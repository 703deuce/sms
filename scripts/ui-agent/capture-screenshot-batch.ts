/**
 * Capture screenshots for screenshot-polish jobs in parallel.
 *
 *   DEV_AUTH_BYPASS=1 UI_AGENT_BASE_URL=http://localhost:3000 npm run ui:capture-screenshot-batch
 */
import { existsSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { captureCurrentSite } from "./capture-current";
import { UI_AGENT_DIR } from "./config";
import type { ScreenshotPolishBatch, ScreenshotPolishJob } from "./kimi-screenshot-batch";

const JOBS_PATH = join(UI_AGENT_DIR, "batch", "screenshot-polish-jobs.json");
const SHOTS_DIR = join(UI_AGENT_DIR, "screenshots");

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

async function captureOne(
  job: ScreenshotPolishJob & { path: string },
  baseUrl: string,
): Promise<void> {
  const outDir = join(SHOTS_DIR, job.id);
  mkdirSync(outDir, { recursive: true });
  await captureCurrentSite({
    baseUrl,
    targetPath: job.path,
    outputDir: outDir,
    viewports: ["desktop"],
    screenshots: true,
    video: false,
    useDevBypass: true,
  });
  const shot = join(outDir, "current-desktop.png");
  const dest = job.screenshot;
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(shot)) renameSync(shot, dest);
  console.log(`✓ ${job.id} → ${dest}`);
}

async function runConcurrent(
  jobs: Array<ScreenshotPolishJob & { path: string }>,
  baseUrl: string,
  concurrency: number,
): Promise<void> {
  let cursor = 0;
  let active = 0;
  let done = 0;
  const total = jobs.length;

  await new Promise<void>((resolve, reject) => {
    const pump = (): void => {
      while (active < concurrency && cursor < total) {
        const job = jobs[cursor++];
        active++;
        captureOne(job, baseUrl)
          .then(() => {
            active--;
            done++;
            if (done >= total) resolve();
            else pump();
          })
          .catch((err) => reject(err));
      }
    };
    pump();
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const jobsPath = parseArg(args, "--jobs") || JOBS_PATH;
  const concurrency = Math.max(1, Number(parseArg(args, "--concurrency") || 10));
  const baseUrl =
    process.env.UI_AGENT_BASE_URL?.trim() || process.env.BASE_URL?.trim() || "http://localhost:3000";

  if (!existsSync(jobsPath)) throw new Error(`Jobs file not found: ${jobsPath}`);

  const batch = JSON.parse(readFileSync(jobsPath, "utf8")) as ScreenshotPolishBatch & {
    jobs: Array<ScreenshotPolishJob & { path: string }>;
  };

  mkdirSync(SHOTS_DIR, { recursive: true });

  const jobs = batch.jobs.filter((j) => j.path);
  console.log(`\nCapturing ${jobs.length} screenshot(s) | concurrency=${concurrency}\n`);

  const started = Date.now();
  await runConcurrent(jobs, baseUrl, Math.min(concurrency, jobs.length));
  console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
