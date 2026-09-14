import { analyzeSmsBody } from "@/lib/sms/segment-encoding";

export type CertSmsSample = {
  segmentCount: number;
  characterCount: number;
  encoding: "GSM7" | "UCS2";
};

const samples: CertSmsSample[] = [];

export function resetCertE2eSmsMetrics(): void {
  samples.length = 0;
}

export function recordCertE2eOutboundSms(body: string): void {
  const trimmed = body.trim();
  if (!trimmed) return;
  const a = analyzeSmsBody(trimmed);
  samples.push({
    segmentCount: a.segmentCount,
    characterCount: a.characterCount,
    encoding: a.encoding,
  });
}

export type CertSmsMetricsSummary = {
  outboundSmsCount: number;
  measuredSmsCount: number;
  oneSegmentCount: number;
  twoSegmentCount: number;
  threePlusSegmentCount: number;
  oneSegmentReplyRate: number;
  avgSegmentsPerReply: number;
  p95SegmentsPerReply: number;
  avgCharactersPerReply: number;
  p95CharactersPerReply: number;
  gsm7Count: number;
  ucs2Count: number;
  unnecessary3Plus: number;
};

export function summarizeCertE2eSmsMetrics(): CertSmsMetricsSummary {
  const measuredSmsCount = samples.length;
  const segments = samples.map((s) => s.segmentCount);
  const chars = samples.map((s) => s.characterCount);
  const sortedSeg = [...segments].sort((a, b) => a - b);
  const sortedChar = [...chars].sort((a, b) => a - b);
  const p95Idx = (arr: number[]) =>
    arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * 0.95))] : 0;
  const oneSegmentCount = segments.filter((s) => s === 1).length;
  const twoSegmentCount = segments.filter((s) => s === 2).length;
  const threePlusSegmentCount = segments.filter((s) => s >= 3).length;
  const avgSegments = measuredSmsCount
    ? segments.reduce((a, b) => a + b, 0) / measuredSmsCount
    : 0;
  const avgChars = measuredSmsCount ? chars.reduce((a, b) => a + b, 0) / measuredSmsCount : 0;
  const oneRate = measuredSmsCount ? (oneSegmentCount / measuredSmsCount) * 100 : 0;
  const unnecessary3Plus = threePlusSegmentCount;

  return {
    outboundSmsCount: measuredSmsCount,
    measuredSmsCount,
    oneSegmentCount,
    twoSegmentCount,
    threePlusSegmentCount,
    oneSegmentReplyRate: oneRate,
    avgSegmentsPerReply: avgSegments,
    p95SegmentsPerReply: p95Idx(sortedSeg),
    avgCharactersPerReply: avgChars,
    p95CharactersPerReply: p95Idx(sortedChar),
    gsm7Count: samples.filter((s) => s.encoding === "GSM7").length,
    ucs2Count: samples.filter((s) => s.encoding === "UCS2").length,
    unnecessary3Plus,
  };
}
