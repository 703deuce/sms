/**
 * Single source of truth for power-dialer KPIs (Overview, Analytics, History, Number health).
 */

import type { AnswerClassification } from "./types";

export { isHumanConversation, dispositionIsTerminal } from "./disposition-effects";

export function countsAsAnswered(input: {
  answeredAt?: Date | null;
  status?: string | null;
}): boolean {
  if (input.answeredAt) return true;
  const s = (input.status || "").toLowerCase();
  return s === "answered" || s === "completed" || s === "in_progress";
}

export function isNonHumanClassification(classification: string | null | undefined): boolean {
  if (!classification) return false;
  return (
    classification === "screener" ||
    classification === "voicemail" ||
    classification === "ivr" ||
    classification === "fax" ||
    classification === "uncertain"
  );
}

export function attemptCountsForMetrics(attempt: {
  id: string;
  disposition: string | null;
  answerClassification: string | null;
  billableSeconds?: number | null;
}): { human: boolean; screened: boolean } {
  const human = isHumanConversation(attempt.disposition, attempt.answerClassification as AnswerClassification);
  const screened = attempt.answerClassification === "screener";
  return { human, screened };
}

/** Dedupe webhook-retried attempts by id (same row must not double-count). */
export function dedupeAttemptsById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}
