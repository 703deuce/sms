import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { UI_AGENT_SESSIONS_DIR } from "./config";
import { appendProgressLog } from "./progress";

export type KimiTimingReport = {
  sessionId: string;
  startedAt: string;
  updatedAt: string;
  /** ms from session start */
  referenceResolvedMs?: number;
  videoUploadCompleteMs?: number;
  kimiFileId?: string;
  kimiFileFromCache?: boolean;
  modelRequestAcceptedMs?: number;
  firstReasoningTokenMs?: number;
  firstContentTokenMs?: number;
  firstCompleteFileMs?: number;
  allFilesCompleteMs?: number;
  previewRenderedMs?: number;
  completedFiles?: string[];
  generationTotalMs?: number;
};

const reports = new Map<string, KimiTimingReport>();
const sessionStart = new Map<string, number>();

function sessionDir(sessionId: string): string {
  return join(UI_AGENT_SESSIONS_DIR, sessionId);
}

function timingPath(sessionId: string): string {
  return join(sessionDir(sessionId), "timing.json");
}

function persist(sessionId: string): void {
  const report = reports.get(sessionId);
  if (!report) return;
  report.updatedAt = new Date().toISOString();
  writeFileSync(timingPath(sessionId), JSON.stringify(report, null, 2), "utf8");
}

export function startKimiTiming(sessionId: string): void {
  const now = new Date().toISOString();
  sessionStart.set(sessionId, Date.now());
  reports.set(sessionId, { sessionId, startedAt: now, updatedAt: now });
  persist(sessionId);
}

export function markKimiTiming(
  sessionId: string,
  key: keyof Omit<KimiTimingReport, "sessionId" | "startedAt" | "updatedAt">,
  value?: number | string | boolean | string[],
): void {
  const started = sessionStart.get(sessionId) ?? Date.now();
  const report = reports.get(sessionId) || {
    sessionId,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (typeof value === "string" || typeof value === "boolean" || Array.isArray(value)) {
    (report as Record<string, unknown>)[key] = value;
  } else {
    (report as Record<string, unknown>)[key] = value ?? Date.now() - started;
  }

  reports.set(sessionId, report as KimiTimingReport);
  persist(sessionId);

  const elapsed = typeof value === "number" ? value : Date.now() - started;
  appendProgressLog(sessionId, `timing_${String(key)}=${typeof value === "undefined" ? elapsed : value}`);
}

export function logKimiTiming(sessionId: string, label: string): void {
  const report = reports.get(sessionId);
  if (!report) return;
  appendProgressLog(sessionId, `timing_summary_${label}: ${JSON.stringify(report)}`);
}

export function getKimiTiming(sessionId: string): KimiTimingReport {
  return reports.get(sessionId) || { sessionId, startedAt: "", updatedAt: "" };
}

export function printKimiTimingReport(sessionId: string): void {
  const t = getKimiTiming(sessionId);
  const cacheNote = t.kimiFileFromCache ? " (cached ms://)" : "";
  console.log("\n--- Kimi timing report ---");
  console.log(`video_upload_complete:     ${fmt(t.videoUploadCompleteMs)}${cacheNote}`);
  console.log(`kimi_file_id:              ${t.kimiFileId ?? "—"}`);
  console.log(`model_request_accepted:    ${fmt(t.modelRequestAcceptedMs)}`);
  console.log(`first_reasoning_token:     ${fmt(t.firstReasoningTokenMs)}`);
  console.log(`first_content_token:       ${fmt(t.firstContentTokenMs)}`);
  console.log(`first_complete_file:       ${fmt(t.firstCompleteFileMs)}${t.completedFiles?.[0] ? ` (${t.completedFiles[0]})` : ""}`);
  console.log(`all_files_complete:        ${fmt(t.allFilesCompleteMs)}`);
  console.log(`preview_rendered:          ${fmt(t.previewRenderedMs)}`);
  console.log(`generation_total:          ${fmt(t.generationTotalMs)}`);
  console.log(`timing.json: ${timingPath(sessionId)}`);
  console.log("");
}

function fmt(ms?: number): string {
  if (ms == null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}
