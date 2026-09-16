import type { IntakeFieldKey } from "../intake/types";

export type StructuredExtractionFieldStatus = "FOUND" | "NOT_FOUND" | "AMBIGUOUS";

export type StructuredExtractionFieldRow = {
  fieldKey: string;
  status: StructuredExtractionFieldStatus;
  candidateValue?: string | null;
  confidence?: number;
  evidenceSpeaker?: "caller" | "agent";
  evidenceSpan?: string;
  isExplicitCorrection?: boolean;
};

export type StructuredPostCallExtractionResult = {
  fields: StructuredExtractionFieldRow[];
  model?: string;
  provider?: string;
};

export type OrderedTranscriptTurn = {
  speaker: "caller" | "agent";
  text: string;
  lineIndex?: number;
};

export function normalizeStructuredExtractionPayload(
  raw: unknown,
  enabledKeys: Set<string>,
): StructuredPostCallExtractionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rows = Array.isArray(o.fields) ? o.fields : [];
  const fields: StructuredExtractionFieldRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const fieldKey = String(r.fieldKey || "").trim();
    if (!fieldKey || !enabledKeys.has(fieldKey)) continue;
    const status = String(r.status || "").trim() as StructuredExtractionFieldStatus;
    if (status !== "FOUND" && status !== "NOT_FOUND" && status !== "AMBIGUOUS") continue;
    const speaker = String(r.evidenceSpeaker || "").trim();
    fields.push({
      fieldKey,
      status,
      candidateValue:
        r.candidateValue === null || r.candidateValue === undefined
          ? undefined
          : String(r.candidateValue).trim() || undefined,
      confidence: typeof r.confidence === "number" ? r.confidence : undefined,
      evidenceSpeaker:
        speaker === "caller" || speaker === "agent" ? speaker : undefined,
      evidenceSpan: r.evidenceSpan ? String(r.evidenceSpan).slice(0, 500) : undefined,
      isExplicitCorrection: r.isExplicitCorrection === true,
    });
  }
  return { fields };
}

export function structuredRowsToPostCallCandidates(
  rows: StructuredExtractionFieldRow[],
): import("./types").VoiceV2PostCallFieldCandidate[] {
  return rows.map((row) => ({
    fieldKey: row.fieldKey as IntakeFieldKey,
    verdict: row.status,
    candidateValue: row.candidateValue || undefined,
    evidence: row.evidenceSpan,
    confidence: row.confidence,
    source: "POST_CALL_TRANSCRIPT",
    channel: row.evidenceSpeaker === "agent" ? "agent" : "caller",
    isExplicitCorrection: row.isExplicitCorrection,
  }));
}
