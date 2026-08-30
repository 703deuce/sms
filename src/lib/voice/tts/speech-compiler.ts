/**
 * SpeechCompiler — semantic LLM output → speakable TTS utterances.
 * Preserves canonical/display forms separately from speech forms.
 */

import { normalizeTtsText } from "./normalize-tts-text";

export type SpeechValueTriple = {
  canonical: string;
  display: string;
  speech: string;
};

export type TtsCommitMode = "fast" | "contextual";

export type CompiledSpeechUtterance = {
  /** Original semantic text from LLM (unchanged). */
  semanticText: string;
  /** Text safe to send to TTS after normalization. */
  speechText: string;
  /** Recommended buffering policy for this utterance. */
  commitMode: TtsCommitMode;
  /** Optional phrase-sized segments for multi-request TTS with continuity. */
  segments: string[];
};

const FAST_PHRASES = new Set([
  "sure.",
  "one second.",
  "one moment.",
  "let me check.",
  "let me take a look.",
  "thanks for calling.",
  "are you still there?",
  "i didn't catch that.",
]);

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function endsWithSentenceBoundary(text: string): boolean {
  return /[.!?…]["')\]]?\s*$/.test(text.trim());
}

/**
 * Decide FAST (complete short phrase) vs CONTEXTUAL (needs more linguistic context).
 * FAST is for known micro-phrases or complete short sentences.
 * CONTEXTUAL defers to ElevenLabs buffer / SentenceTokenizer — do not micro-chunk.
 */
export function resolveTtsCommitMode(semanticText: string): TtsCommitMode {
  const trimmed = semanticText.trim();
  if (!trimmed) return "contextual";
  const lower = trimmed.toLowerCase();
  if (FAST_PHRASES.has(lower)) return "fast";
  if (trimmed.length <= 80 && endsWithSentenceBoundary(trimmed) && wordCount(trimmed) <= 14) {
    return "fast";
  }
  return "contextual";
}

/** Split on sentence boundaries without breaking words. */
export function splitSpeechSegments(speechText: string): string[] {
  const parts = speechText
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts : [speechText.trim()].filter(Boolean);
}

export function compileSemanticForSpeech(semanticText: string): CompiledSpeechUtterance {
  const speechText = normalizeTtsText(semanticText);
  const commitMode = resolveTtsCommitMode(semanticText);
  return {
    semanticText,
    speechText,
    commitMode,
    segments: splitSpeechSegments(speechText),
  };
}

/** Build canonical/display/speech triple for structured values (phones, money, dates). */
export function speechTripleFromCanonical(
  canonical: string,
  display?: string,
): SpeechValueTriple {
  const displayValue = display ?? canonical;
  return {
    canonical,
    display: displayValue,
    speech: normalizeTtsText(displayValue),
  };
}
