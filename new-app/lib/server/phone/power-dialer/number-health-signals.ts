import { isHumanConversation } from "./disposition-effects";

export type NumberSignalInput = {
  attemptId: string;
  createdAt: Date;
  disposition: string | null;
  answerClassification: string | null;
  billableSeconds: number | null;
  answeredAt: Date | null;
  endedAt: Date | null;
  startedAt: Date | null;
};

const SPAM_DISPO_PATTERNS = [
  /do not call/i,
  /dnc/i,
  /spam/i,
  /wrong number/i,
  /harass/i,
  /complaint/i,
  /report/i,
];

export type WindowMetrics = {
  attempts: number;
  answered: number;
  answerRatePct: number | null;
  shortCallRatePct: number | null;
  voicemailNoAnswerRatePct: number | null;
  spamFlagCount: number;
  humanConversations: number;
};

export type NumberHealthAssessment = {
  label: "healthy" | "watch" | "at_risk";
  labelSource: "based_on_your_call_data";
  reasons: string[];
  suggestion: string | null;
  window7: WindowMetrics;
  window30: WindowMetrics;
  trendAnswerRate7vs30: number | null;
};

const SHORT_CALL_SEC = 8;

function isSpamDisposition(disposition: string | null): boolean {
  if (!disposition) return false;
  return SPAM_DISPO_PATTERNS.some((re) => re.test(disposition));
}

function isVoicemailOrNoAnswer(classification: string | null, disposition: string | null): boolean {
  if (classification === "voicemail" || classification === "no_answer") return true;
  if (disposition && /voicemail|no answer/i.test(disposition)) return true;
  return false;
}

function callDurationSec(row: NumberSignalInput): number | null {
  if (row.billableSeconds != null && row.billableSeconds > 0) return row.billableSeconds;
  if (row.answeredAt && row.endedAt) {
    return Math.max(0, Math.round((row.endedAt.getTime() - row.answeredAt.getTime()) / 1000));
  }
  if (row.startedAt && row.endedAt) {
    return Math.max(0, Math.round((row.endedAt.getTime() - row.startedAt.getTime()) / 1000));
  }
  return null;
}

export function computeWindowMetrics(rows: NumberSignalInput[]): WindowMetrics {
  const attempts = rows.length;
  if (!attempts) {
    return {
      attempts: 0,
      answered: 0,
      answerRatePct: null,
      shortCallRatePct: null,
      voicemailNoAnswerRatePct: null,
      spamFlagCount: 0,
      humanConversations: 0,
    };
  }
  let answered = 0;
  let shortCalls = 0;
  let vmNa = 0;
  let spam = 0;
  let human = 0;
  for (const r of rows) {
    if (r.answeredAt) answered += 1;
    const dur = callDurationSec(r);
    if (dur != null && dur > 0 && dur <= SHORT_CALL_SEC) shortCalls += 1;
    if (isVoicemailOrNoAnswer(r.answerClassification, r.disposition)) vmNa += 1;
    if (isSpamDisposition(r.disposition)) spam += 1;
    if (isHumanConversation(r.disposition, r.answerClassification)) human += 1;
  }
  return {
    attempts,
    answered,
    answerRatePct: Math.round((answered / attempts) * 1000) / 10,
    shortCallRatePct: Math.round((shortCalls / attempts) * 1000) / 10,
    voicemailNoAnswerRatePct: Math.round((vmNa / attempts) * 1000) / 10,
    spamFlagCount: spam,
    humanConversations: human,
  };
}

export function assessNumberHealth(w7: WindowMetrics, w30: WindowMetrics): NumberHealthAssessment {
  const reasons: string[] = [];
  let label: NumberHealthAssessment["label"] = "healthy";
  let suggestion: string | null = null;

  const minSamples = w7.attempts >= 15 ? w7 : w30.attempts >= 30 ? w30 : null;
  if (!minSamples) {
    return {
      label: "healthy",
      labelSource: "based_on_your_call_data",
      reasons: ["Not enough recent dials on this number to score (need 15 in 7d or 30 in 30d)."],
      suggestion: null,
      window7: w7,
      window30: w30,
      trendAnswerRate7vs30:
        w7.answerRatePct != null && w30.answerRatePct != null
          ? Math.round((w7.answerRatePct - w30.answerRatePct) * 10) / 10
          : null,
    };
  }

  const ar = minSamples.answerRatePct ?? 0;
  const vm = minSamples.voicemailNoAnswerRatePct ?? 0;
  const short = minSamples.shortCallRatePct ?? 0;
  const spam = minSamples.spamFlagCount;

  if (ar < 8) reasons.push(`Low answer rate (${ar}% in scoring window).`);
  if (vm > 55) reasons.push(`High voicemail / no-answer rate (${vm}%).`);
  if (short > 40) reasons.push(`High short-call rate (≤${SHORT_CALL_SEC}s) at ${short}%.`);
  if (spam >= 3) reasons.push(`${spam} disposition(s) flagged as complaint/spam/DNC in window.`);

  const trend =
    w7.answerRatePct != null && w30.answerRatePct != null
      ? Math.round((w7.answerRatePct - w30.answerRatePct) * 10) / 10
      : null;
  if (trend != null && trend <= -10) {
    reasons.push(`Answer rate trending down (${trend} pts vs 30-day baseline).`);
  }

  if (reasons.length >= 2 || spam >= 5 || ar < 5) {
    label = "at_risk";
    suggestion =
      "Consider resting this caller ID for 24–48 hours or rotating to another owned number in the campaign pool.";
  } else if (reasons.length === 1 || (ar < 12 && ar >= 8)) {
    label = "watch";
    suggestion = "Monitor closely; reduce daily dial cap or rotate if metrics worsen over the next 2 days.";
  }

  return {
    label,
    labelSource: "based_on_your_call_data",
    reasons: reasons.length ? reasons : ["Metrics within expected range for your recent volume."],
    suggestion,
    window7: w7,
    window30: w30,
    trendAnswerRate7vs30: trend,
  };
}

export function filterRowsSince(rows: NumberSignalInput[], since: Date): NumberSignalInput[] {
  return rows.filter((r) => r.createdAt >= since);
}
