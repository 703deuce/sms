/**
 * Optional Graph span collector for Voice Booking V2 baseline only.
 * Does not affect other callers when inactive.
 */

export type VoiceV2GraphSpan = {
  operation: string;
  httpMs: number;
  status: number;
};

let activeCollector: ((span: VoiceV2GraphSpan) => void) | null = null;

export function beginVoiceV2GraphCollection(collector: (span: VoiceV2GraphSpan) => void) {
  activeCollector = collector;
}

export function endVoiceV2GraphCollection() {
  activeCollector = null;
}

export function emitVoiceV2GraphSpan(span: VoiceV2GraphSpan) {
  activeCollector?.(span);
}
