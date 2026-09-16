import type { VoiceV2IntakeSchema } from "../intake/types";
import type { VoiceV2MultichannelTranscript, VoiceV2PostCallFieldCandidate } from "./types";

const EMAIL_RE = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;

function lines(text: string): string[] {
  return text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
}

function lastMatch(re: RegExp, text: string): string | null {
  const flags = re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
  const matches = [...text.matchAll(flags)];
  if (!matches.length) return null;
  const m = matches[matches.length - 1];
  return (m[1] || m[0] || "").trim() || null;
}

function labelPattern(label: string): RegExp {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}\\s+is\\s+(.+?)(?:[.!?]|$)`, "i");
}

type TranscriptTurn = { speaker: "agent" | "caller"; text: string };

function parseSpeakerTurns(fullText: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = [];
  for (const line of lines(fullText)) {
    const m = line.match(/^(Agent|Caller|Amy):\s*(.+)$/i);
    if (!m?.[2]) continue;
    const who = m[1].toLowerCase();
    turns.push({
      speaker: who === "caller" ? "caller" : "agent",
      text: m[2].trim(),
    });
  }
  return turns;
}

function agentQuestionTargetsField(question: string, key: string, label: string): boolean {
  const q = question.toLowerCase();
  const lbl = label.toLowerCase();
  const keyPhrase = key.replace(/_/g, " ").toLowerCase();
  if (q.includes(lbl)) return true;
  if (keyPhrase.length > 2 && q.includes(keyPhrase)) return true;
  if (/mother/.test(key) && /mother(?:'s)?\s+name/.test(q)) return true;
  if (/father/.test(key) && /father(?:'s)?\s+name/.test(q)) return true;
  if (key === "name" && /\b(your\s+)?name\b/.test(q) && !/mother|father/.test(q)) return true;
  if (key === "email" && /\bemail\b/.test(q)) return true;
  return false;
}

/** Caller answer immediately after an agent question that references the field label/key. */
function extractAnswerAfterAgentQuestion(
  fullText: string,
  key: string,
  label: string,
): { value: string; evidence: string; confidence: number } | null {
  const turns = parseSpeakerTurns(fullText);
  if (!turns.length) return null;

  let best: { value: string; evidence: string; confidence: number; index: number } | null = null;
  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    if (turn.speaker !== "agent" || !agentQuestionTargetsField(turn.text, key, label)) continue;
    const j = i + 1;
    if (j >= turns.length || turns[j].speaker !== "caller") continue;
    const raw = turns[j].text.trim();
    if (!raw) continue;
    const inline =
      raw.match(labelPattern(label)) ||
      raw.match(new RegExp(`\\b${key.replace(/_/g, "[ _]")}\\s+is\\s+(.+?)(?:[.!?]|$)`, "i"));
    const value = (inline?.[1] || raw).replace(/[.!?]+$/, "").trim();
    if (!value || value.length > 160) continue;
    const candidate = {
      value,
      evidence: raw.slice(0, 240),
      confidence: /actually/i.test(raw) ? 0.92 : 0.88,
      index: j,
    };
    if (!best || candidate.index >= best.index) best = candidate;
  }
  return best ? { value: best.value, evidence: best.evidence, confidence: best.confidence } : null;
}

/** Schema-driven conservative extraction from independent post-call transcript (caller channel primary). */
export function extractPostCallFieldCandidates(input: {
  pinnedSchema: VoiceV2IntakeSchema;
  transcript: VoiceV2MultichannelTranscript;
}): VoiceV2PostCallFieldCandidate[] {
  const caller = input.transcript.callerText || input.transcript.fullText;
  const callerLines = lines(caller);
  const out: VoiceV2PostCallFieldCandidate[] = [];

  for (const field of input.pinnedSchema.fields) {
    const key = field.key;
    const label = field.label || key;

    if (key === "email" || field.valueType === "email") {
      const value = lastMatch(EMAIL_RE, caller);
      out.push({
        fieldKey: key,
        verdict: value ? "FOUND" : "NOT_FOUND",
        candidateValue: value || undefined,
        evidence: value ? caller.slice(0, 240) : undefined,
        confidence: value ? 0.9 : undefined,
        source: "POST_CALL_TRANSCRIPT",
        channel: "caller",
      });
      continue;
    }

    const patterns: RegExp[] = [
      labelPattern(label),
      new RegExp(`my ${label.replace(/'/g, "['']?")}\\s+is\\s+(.+?)(?:[.!?]|$)`, "i"),
      new RegExp(`\\b${key.replace(/_/g, "[ _]")}\\s+is\\s+(.+?)(?:[.!?]|$)`, "i"),
      new RegExp(
        `(?:oh[,!]?\\s*(?:yeah|yes)[,!]?\\s*)?my\\s+${label.replace(/'/g, "['']?")}\\s+is\\s+(.+?)(?:[.!?]|$)`,
        "i",
      ),
      new RegExp(
        `(?:oh[,!]?\\s*(?:yeah|yes)[,!]?\\s*)?my\\s+${key.replace(/_/g, "[ _]")}\\s+is\\s+(.+?)(?:[.!?]|$)`,
        "i",
      ),
    ];
    if (key !== "name" && (key.includes("mother") || key.includes("father") || /mother|father/i.test(label))) {
      patterns.push(
        new RegExp(`(?:her|his|their)\\s+name\\s+is\\s+(.+?)(?:[.!?]|$)`, "i"),
        new RegExp(`actually\\s+(?:her|his|their)?\\s*name\\s+is\\s+(.+?)(?:[.!?]|$)`, "i"),
      );
    }

    let found: string | null = null;
    let evidence: string | undefined;
    let confidence = 0.82;
    let isExplicitCorrection = false;
    for (const line of callerLines) {
      for (const re of patterns) {
        const m = line.match(re);
        if (!m?.[1]?.trim()) continue;
        const value = m[1].trim();
        const explicit = /actually/i.test(line);
        // Chronological last match wins (post-call transcript is ordered).
        found = value;
        evidence = line.slice(0, 240);
        confidence = explicit ? 0.92 : 0.82;
        isExplicitCorrection = explicit;
      }
    }

    if (!found && (key === "mother_s_name" || /mother/i.test(label))) {
      for (const line of callerLines) {
        const m = line.match(/mother(?:'s)?\s+name\s+is\s+(.+?)(?:[.!?]|$)/i);
        if (m?.[1]?.trim()) {
          found = m[1].trim();
          evidence = line.slice(0, 240);
          confidence = 0.9;
          break;
        }
      }
    }

    if (!found && input.transcript.fullText) {
      const qa = extractAnswerAfterAgentQuestion(input.transcript.fullText, key, label);
      if (qa) {
        found = qa.value;
        evidence = qa.evidence;
        confidence = qa.confidence;
        isExplicitCorrection = /actually/i.test(qa.evidence);
      }
    }

    out.push({
      fieldKey: key,
      verdict: found ? "FOUND" : "NOT_FOUND",
      candidateValue: found || undefined,
      evidence,
      confidence: found ? confidence : undefined,
      isExplicitCorrection: found ? isExplicitCorrection : undefined,
      source: "POST_CALL_TRANSCRIPT",
      channel: "caller",
    });
  }

  return out;
}
