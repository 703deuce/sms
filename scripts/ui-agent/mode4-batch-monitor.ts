/**
 * Live heartbeat monitor for concurrent Kimi Mode 4 batch jobs.
 * Prints status every N seconds so operators can see progress vs hung jobs.
 */
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_DIR } from "./config";
import { readProgress, type KimiProgress } from "./progress";

export type Mode4ActiveJob = {
  entryId: string;
  canonicalPath: string;
  route: string;
  sessionId?: string;
  startedAt: number;
};

const STALL_WARN_SEC = 90;

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m${s.toString().padStart(2, "0")}s`;
}

function streamCharHint(sessionId: string): string {
  const livePath = join(UI_AGENT_DIR, "sessions", sessionId, "kimi-live.txt");
  if (!existsSync(livePath)) return "";
  try {
    const size = statSync(livePath).size;
    if (size > 0) return ` | stream ${(size / 1024).toFixed(1)}KB`;
  } catch {
    /* ignore */
  }
  return "";
}

function progressLine(job: Mode4ActiveJob, progress: KimiProgress | null): string {
  const elapsed = formatElapsed(Math.round((Date.now() - job.startedAt) / 1000));
  if (!job.sessionId) {
    return `  ${job.canonicalPath.padEnd(36)} waiting for session… ${elapsed}`;
  }
  if (!progress) {
    return `  ${job.canonicalPath.padEnd(36)} session ${job.sessionId.slice(-8)} | starting… ${elapsed}`;
  }
  const stallSec = Math.round((Date.now() - new Date(progress.updatedAt).getTime()) / 1000);
  const stall =
    progress.phase !== "ready" && progress.phase !== "error" && stallSec >= STALL_WARN_SEC
      ? ` ⚠ no update ${stallSec}s`
      : "";
  const msg = progress.message.length > 48 ? `${progress.message.slice(0, 45)}…` : progress.message;
  const stream = streamCharHint(job.sessionId);
  return `  ${job.canonicalPath.padEnd(36)} [${progress.phase}] ${formatElapsed(progress.elapsedSec)} | ${msg}${stream}${stall}`;
}

export function startMode4BatchMonitor(
  getActiveJobs: () => Mode4ActiveJob[],
  getTotals: () => { done: number; total: number },
  intervalMs = 10_000,
): { stop: () => void } {
  console.log("\n[Mode4 monitor] Live status every 10s — per-job: tail -f .ui-agent/sessions/<sessionId>/progress.log\n");

  const timer = setInterval(() => {
    const active = getActiveJobs();
    const { done, total } = getTotals();
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`\n── [Mode4 live ${ts}] active ${active.length} | done ${done}/${total} ──`);
    if (active.length === 0) {
      console.log("  (no active jobs)");
      return;
    }
    for (const job of active) {
      const progress = job.sessionId ? readProgress(job.sessionId) : null;
      console.log(progressLine(job, progress));
      if (job.sessionId) {
        console.log(`    session: ${job.sessionId}`);
        console.log(`    tail:    tail -f .ui-agent/sessions/${job.sessionId}/progress.log`);
      }
    }
  }, intervalMs);

  return {
    stop: () => clearInterval(timer),
  };
}
