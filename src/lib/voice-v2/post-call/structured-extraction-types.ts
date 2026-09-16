import type { IntakeFieldKey, VoiceV2IntakeSchema } from "../intake/types";
import {
  normalizePostCallExtractedValue,
  normalizeSpokenCount,
} from "./normalize-extracted-value";

export type StructuredExtractionFieldStatus = "FOUND" | "NOT_FOUND" | "AMBIGUOUS";

export type StructuredExtractionEvidence = {
  speaker: "CALLER" | "AGENT";
  text: string;
  startMs?: number;
  endMs?: number;
};

export type StructuredExtractionFieldRow = {
  fieldKey: string;
  status: StructuredExtractionFieldStatus;
  value?: string | null;
  confidence?: number;
  evidence?: StructuredExtractionEvidence[];
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
  startMs?: number;
  endMs?: number;
};

function parseEvidence(raw: unknown): StructuredExtractionEvidence[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: StructuredExtractionEvidence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const e = item as Record<string, unknown>;
    const speaker = String(e.speaker || "").toUpperCase();
    const text = String(e.text || "").trim();
    if (!text) continue;
    out.push({
      speaker: speaker === "AGENT" ? "AGENT" : "CALLER",
      text: text.slice(0, 500),
      startMs: typeof e.startMs === "number" ? e.startMs : undefined,
      endMs: typeof e.endMs === "number" ? e.endMs : undefined,
    });
  }
  return out.length ? out : undefined;
}

function readRowValue(r: Record<string, unknown>): string | undefined {
  const v = r.value ?? r.candidateValue;
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

export function normalizeStructuredExtractionPayload(
  raw: unknown,
  enabledKeys: Set<string>,
  schema?: VoiceV2IntakeSchema,
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

    let value = status === "FOUND" ? readRowValue(r) : undefined;
    if (status === "FOUND" && value && schema) {
      const field = schema.fields.find((f) => f.key === fieldKey);
      const countField =
        field &&
        (/\bcount\b|_qty$|_number$/i.test(fieldKey) || /\bcount\b/i.test(field.label || ""));
      if (countField) {
        const n = normalizeSpokenCount(value);
        if (n) value = n;
      } else {
        const normalized = normalizePostCallExtractedValue(schema, fieldKey, value);
        if (normalized) value = normalized;
      }
    }

    fields.push({
      fieldKey,
      status,
      value,
      confidence: typeof r.confidence === "number" ? r.confidence : undefined,
      evidence: parseEvidence(r.evidence),
      isExplicitCorrection: r.isExplicitCorrection === true,
    });
  }
  return { fields };
}

/** Ensure one row per pinned schema field (NOT_FOUND when model omitted a key). */
export function completeExtractionRowsForSchema(
  schema: VoiceV2IntakeSchema,
  partial: StructuredExtractionFieldRow[],
): StructuredExtractionFieldRow[] {
  const byKey = new Map(partial.map((r) => [r.fieldKey, r]));
  return schema.fields.map((f) =>
    byKey.get(f.key) || { fieldKey: f.key, status: "NOT_FOUND" },
  );
}

function primaryCallerEvidence(row: StructuredExtractionFieldRow): string | undefined {
  const ev = row.evidence?.find((e) => e.speaker === "CALLER") || row.evidence?.[0];
  return ev?.text?.slice(0, 500);
}

export function structuredRowsToPostCallCandidates(
  rows: StructuredExtractionFieldRow[],
): import("./types").VoiceV2PostCallFieldCandidate[] {
  return rows.map((row) => ({
    fieldKey: row.fieldKey as IntakeFieldKey,
    verdict: row.status,
    candidateValue: row.status === "FOUND" ? row.value || undefined : undefined,
    evidence: primaryCallerEvidence(row),
    confidence: row.confidence,
    source: "POST_CALL_LLM_EXTRACTION",
    channel:
      row.evidence?.some((e) => e.speaker === "CALLER")
        ? "caller"
        : row.evidence?.length
          ? "agent"
          : undefined,
    isExplicitCorrection: row.isExplicitCorrection,
  }));
}
