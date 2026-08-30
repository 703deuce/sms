import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_SESSIONS_DIR } from "./config";
import { log } from "./logger";

export type KimiProgressPhase =
  | "starting"
  | "resolving_media"
  | "uploading_video"
  | "processing_video"
  | "generating_ui"
  | "refining"
  | "screenshot"
  | "ready"
  | "error";

export type KimiProgress = {
  sessionId: string;
  phase: KimiProgressPhase;
  message: string;
  percent?: number;
  startedAt: string;
  updatedAt: string;
  elapsedSec: number;
  log: string[];
};

const MAX_LOG_LINES = 40;

function sessionDir(sessionId: string): string {
  return join(UI_AGENT_SESSIONS_DIR, sessionId);
}

function progressPath(sessionId: string): string {
  return join(sessionDir(sessionId), "progress.json");
}

function progressLogPath(sessionId: string): string {
  return join(sessionDir(sessionId), "progress.log");
}

function nowIso(): string {
  return new Date().toISOString();
}

function elapsedSec(startedAt: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000));
}

function ensureSessionDir(sessionId: string): void {
  const dir = sessionDir(sessionId);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export function readProgress(sessionId: string): KimiProgress | null {
  const path = progressPath(sessionId);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as KimiProgress;
  } catch {
    return null;
  }
}

export function initProgress(sessionId: string, message: string): KimiProgress {
  ensureSessionDir(sessionId);
  const startedAt = nowIso();
  const progress: KimiProgress = {
    sessionId,
    phase: "starting",
    message,
    startedAt,
    updatedAt: startedAt,
    elapsedSec: 0,
    log: [],
  };
  writeFileSync(progressPath(sessionId), JSON.stringify(progress, null, 2), "utf8");
  appendProgressLog(sessionId, message);
  log("progress", `${sessionId} — ${message}`);
  return progress;
}

export function updateProgress(
  sessionId: string,
  patch: {
    phase?: KimiProgressPhase;
    message?: string;
    percent?: number;
  },
): KimiProgress {
  ensureSessionDir(sessionId);
  const existing =
    readProgress(sessionId) ||
    initProgress(sessionId, patch.message || "Starting Kimi session…");

  const next: KimiProgress = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
    elapsedSec: elapsedSec(existing.startedAt),
  };

  writeFileSync(progressPath(sessionId), JSON.stringify(next, null, 2), "utf8");
  if (patch.message) {
    appendProgressLog(sessionId, `[${next.phase}] ${patch.message} (${next.elapsedSec}s)`);
    log("progress", `${sessionId} — [${next.phase}] ${patch.message} (${next.elapsedSec}s)`);
  }
  return next;
}

export function appendProgressLog(sessionId: string, line: string): void {
  ensureSessionDir(sessionId);
  const stamp = new Date().toISOString();
  const entry = `${stamp} ${line}`;
  appendFileSync(progressLogPath(sessionId), `${entry}\n`, "utf8");

  const current = readProgress(sessionId);
  if (current) {
    const logLines = [...current.log, line].slice(-MAX_LOG_LINES);
    const next = { ...current, log: logLines, updatedAt: stamp, elapsedSec: elapsedSec(current.startedAt) };
    writeFileSync(progressPath(sessionId), JSON.stringify(next, null, 2), "utf8");
  }
}

export function markProgressError(sessionId: string, message: string): void {
  updateProgress(sessionId, { phase: "error", message });
}

export function markProgressReady(sessionId: string, message: string): void {
  updateProgress(sessionId, { phase: "ready", message, percent: 100 });
}

export function progressTailPath(sessionId: string): string {
  return progressLogPath(sessionId);
}
