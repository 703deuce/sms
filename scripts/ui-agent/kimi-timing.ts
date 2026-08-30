import { appendProgressLog } from "./progress";

export type KimiTimingMarks = {
  referenceResolvedMs?: number;
  supabaseDownloadStartedMs?: number;
  supabaseDownloadCompletedMs?: number;
  kimiUploadStartedMs?: number;
  kimiUploadCompletedMs?: number;
  kimiFileStatus?: string;
  kimiGenerationStartedMs?: number;
  kimiFirstResponseMs?: number;
  kimiGenerationCompletedMs?: number;
};

const marks = new Map<string, KimiTimingMarks>();
const sessionStart = new Map<string, number>();

export function startKimiTiming(sessionId: string): void {
  sessionStart.set(sessionId, Date.now());
  marks.set(sessionId, {});
}

export function markKimiTiming(sessionId: string, key: keyof KimiTimingMarks, value?: number | string): void {
  const started = sessionStart.get(sessionId) ?? Date.now();
  const current = marks.get(sessionId) || {};
  if (typeof value === "string") {
    current[key] = value as never;
  } else {
    current[key] = (value ?? Date.now() - started) as never;
  }
  marks.set(sessionId, current);
}

export function logKimiTiming(sessionId: string, label: string): void {
  const m = marks.get(sessionId);
  if (!m) return;
  const parts = Object.entries(m)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  appendProgressLog(sessionId, `timing ${label}: ${parts}`);
}

export function getKimiTiming(sessionId: string): KimiTimingMarks {
  return marks.get(sessionId) || {};
}
