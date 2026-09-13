import { analyzeSmsBody } from "@/lib/sms/segment-encoding";
import { phraseLeadRecoverySmsReply } from "@/lib/mctb/lead-recovery/sms-phrasing";
import type { CertFailure } from "@/lib/mctb/lead-recovery/testing/cert-runner";
import {
  DETERMINISTIC_SMS_TEMPLATE_CHECKS,
  SMS_PHRASING_CERT_SCENARIOS,
} from "@/lib/mctb/lead-recovery/testing/cert-sms-scenarios";

export type SmsCertMetrics = {
  samples: number;
  avgCharacters: number;
  p95Characters: number;
  avgSegments: number;
  p95Segments: number;
  percentOneSegment: number;
  percentTwoSegments: number;
  percent3PlusSegments: number;
  oneSegmentReplyRate: number;
  threePlusSegmentReplyRate: number;
  unnecessaryUcs2Count: number;
  unnecessary3PlusSegmentCount: number;
  multiOutboundPerTurnRate: number;
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}

function scoreReply(input: {
  scenarioId: string;
  body: string;
  ordinary: boolean;
  allowThreePlus: boolean;
}): { hard: CertFailure[]; soft: CertFailure[]; analysis: ReturnType<typeof analyzeSmsBody> } {
  const analysis = analyzeSmsBody(input.body);
  const hard: CertFailure[] = [];
  const soft: CertFailure[] = [];

  if (input.ordinary && !input.allowThreePlus && analysis.segmentCount >= 3) {
    hard.push({
      scenarioId: input.scenarioId,
      failureClass: "RESPONSE_FAILURE",
      detail: `UNNECESSARY_3_PLUS_SEGMENT_REPLY segments=${analysis.segmentCount} chars=${analysis.characterCount} encoding=${analysis.encoding} body=${input.body.slice(0, 120)}`,
    });
  }
  if (analysis.unnecessaryUcs2) {
    hard.push({
      scenarioId: input.scenarioId,
      failureClass: "COMPLIANCE_FAILURE",
      detail: `UNNECESSARY_UCS2 encoding forced by decorative characters`,
    });
  }
  if (input.ordinary && analysis.segmentCount === 2 && analysis.characterCount > 200) {
    soft.push({
      scenarioId: input.scenarioId,
      failureClass: "RESPONSE_FAILURE",
      detail: `verbose 2-segment reply chars=${analysis.characterCount}`,
    });
  }
  return { hard, soft, analysis };
}

export async function runSmsSegmentCertification(input?: {
  deepSeekPhrasing?: boolean;
}): Promise<{ metrics: SmsCertMetrics; hardFailures: CertFailure[]; softFailures: CertFailure[] }> {
  const hardFailures: CertFailure[] = [];
  const softFailures: CertFailure[] = [];
  const charCounts: number[] = [];
  const segmentCounts: number[] = [];
  let unnecessaryUcs2Count = 0;
  let unnecessary3Plus = 0;

  for (const tpl of DETERMINISTIC_SMS_TEMPLATE_CHECKS) {
    const ordinary = tpl.category === "ordinary";
    const scored = scoreReply({
      scenarioId: tpl.id,
      body: tpl.body,
      ordinary,
      allowThreePlus: tpl.allowThreePlusSegments === true,
    });
    hardFailures.push(...scored.hard);
    softFailures.push(...scored.soft);
    charCounts.push(scored.analysis.characterCount);
    segmentCounts.push(scored.analysis.segmentCount);
    if (scored.analysis.unnecessaryUcs2) unnecessaryUcs2Count++;
    if (ordinary && scored.analysis.segmentCount >= 3) unnecessary3Plus++;
  }

  const useLlm = input?.deepSeekPhrasing !== false && process.env.LR_CERT_FORCE_DEEPSEEK === "1";
  if (useLlm) {
    for (const scenario of SMS_PHRASING_CERT_SCENARIOS) {
      const body = await phraseLeadRecoverySmsReply({
        facts: scenario.facts,
        fallbackText: scenario.fallbackText,
      });
      const ordinary = scenario.category === "ordinary";
      const scored = scoreReply({
        scenarioId: scenario.id,
        body,
        ordinary,
        allowThreePlus: scenario.allowThreePlusSegments === true,
      });
      hardFailures.push(...scored.hard);
      softFailures.push(...scored.soft);
      charCounts.push(scored.analysis.characterCount);
      segmentCounts.push(scored.analysis.segmentCount);
      if (scored.analysis.unnecessaryUcs2) unnecessaryUcs2Count++;
      if (ordinary && scored.analysis.segmentCount >= 3) unnecessary3Plus++;
    }
  } else {
    for (const scenario of SMS_PHRASING_CERT_SCENARIOS) {
      const scored = scoreReply({
        scenarioId: `${scenario.id}-fallback`,
        body: scenario.fallbackText,
        ordinary: scenario.category === "ordinary",
        allowThreePlus: scenario.allowThreePlusSegments === true,
      });
      hardFailures.push(...scored.hard);
      softFailures.push(...scored.soft);
      charCounts.push(scored.analysis.characterCount);
      segmentCounts.push(scored.analysis.segmentCount);
    }
  }

  const sortedChars = [...charCounts].sort((a, b) => a - b);
  const sortedSegs = [...segmentCounts].sort((a, b) => a - b);
  const samples = charCounts.length;
  const oneSeg = segmentCounts.filter((s) => s === 1).length;
  const twoSeg = segmentCounts.filter((s) => s === 2).length;
  const threePlus = segmentCounts.filter((s) => s >= 3).length;

  const metrics: SmsCertMetrics = {
    samples,
    avgCharacters: samples ? charCounts.reduce((a, b) => a + b, 0) / samples : 0,
    p95Characters: percentile(sortedChars, 0.95),
    avgSegments: samples ? segmentCounts.reduce((a, b) => a + b, 0) / samples : 0,
    p95Segments: percentile(sortedSegs, 0.95),
    percentOneSegment: samples ? (oneSeg / samples) * 100 : 0,
    percentTwoSegments: samples ? (twoSeg / samples) * 100 : 0,
    percent3PlusSegments: samples ? (threePlus / samples) * 100 : 0,
    oneSegmentReplyRate: samples ? (oneSeg / samples) * 100 : 0,
    threePlusSegmentReplyRate: samples ? (threePlus / samples) * 100 : 0,
    unnecessaryUcs2Count,
    unnecessary3PlusSegmentCount: unnecessary3Plus,
    multiOutboundPerTurnRate: 0,
  };

  return { metrics, hardFailures, softFailures };
}
