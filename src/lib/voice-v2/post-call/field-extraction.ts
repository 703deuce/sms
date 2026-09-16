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
    for (const line of callerLines) {
      for (const re of patterns) {
        const m = line.match(re);
        if (m?.[1]?.trim()) {
          found = m[1].trim();
          evidence = line.slice(0, 240);
          if (/actually/i.test(line)) confidence = 0.92;
          break;
        }
      }
      if (found) break;
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

    out.push({
      fieldKey: key,
      verdict: found ? "FOUND" : "NOT_FOUND",
      candidateValue: found || undefined,
      evidence,
      confidence: found ? confidence : undefined,
      source: "POST_CALL_TRANSCRIPT",
      channel: "caller",
    });
  }

  return out;
}
