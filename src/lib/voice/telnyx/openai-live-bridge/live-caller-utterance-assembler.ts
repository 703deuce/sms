/**
 * Debounced caller utterance boundary — audio silence ≠ finalized meaning.
 * Transcript deltas and caller audio activity feed a per-call buffer; stabilization
 * completes only after a quiet window with no new deltas or resumed speech.
 */

import { performance } from "node:perf_hooks";

export type StableCallerUtterance = {
  utterance_id: string;
  revision: number;
  start_ms: number;
  end_ms: number;
  stable_at: number;
  text: string;
};

export type LiveCallerUtteranceAssemblerConfig = {
  callId: string;
  /** Post-silence / post-delta stabilization (ms). */
  stabilizeMs?: number;
  onStable: (utterance: StableCallerUtterance) => void;
};

function defaultStabilizeMs(): number {
  const raw = Number(process.env.VOICE_V2_UTTERANCE_STABILIZE_MS ?? 650);
  if (!Number.isFinite(raw) || raw < 200) return 650;
  return Math.min(raw, 2500);
}

export class LiveCallerUtteranceAssembler {
  private readonly stabilizeMs: number;
  private readonly onStable: (utterance: StableCallerUtterance) => void;
  private readonly callId: string;

  private utteranceSeq = 0;
  private utteranceId: string | null = null;
  private revision = 0;
  private startMs: number | null = null;
  private lastEndMs = 0;
  private buffer = "";
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCommittedRevision = -1;

  constructor(config: LiveCallerUtteranceAssemblerConfig) {
    this.callId = config.callId;
    this.stabilizeMs = config.stabilizeMs ?? defaultStabilizeMs();
    this.onStable = config.onStable;
  }

  /** Latest in-progress caller text (may still change). */
  peekBuffer(): string {
    return this.buffer.trim();
  }

  currentRevision(): number {
    return this.revision;
  }

  onCallerAudioStarted(perfMs: number) {
    this.cancelSettle();
    this.ensureUtteranceOpen(perfMs);
  }

  /** RMS silence estimate — starts settle only; not authoritative. */
  onCallerAudioEndedEstimate(perfMs: number) {
    this.lastEndMs = perfMs;
    if (!this.buffer.trim() && !this.utteranceId) return;
    this.scheduleSettle(perfMs);
  }

  onTranscriptDelta(delta: string, perfMs = performance.now()) {
    if (!delta) return;
    this.cancelSettle();
    this.ensureUtteranceOpen(perfMs);
    this.buffer += delta;
    this.revision += 1;
    this.lastEndMs = perfMs;
    this.scheduleSettle(perfMs);
  }

  /**
   * Replace buffer from authoritative transcript segment (same revision bump).
   * Used when transcript class has merged segments the assembler should mirror.
   */
  syncBufferFromTranscript(text: string, perfMs = performance.now()) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.cancelSettle();
    this.ensureUtteranceOpen(perfMs);
    if (trimmed === this.buffer.trim()) {
      this.scheduleSettle(perfMs);
      return;
    }
    this.buffer = trimmed;
    this.revision += 1;
    this.lastEndMs = perfMs;
    this.scheduleSettle(perfMs);
  }

  dispose() {
    this.cancelSettle();
  }

  private ensureUtteranceOpen(perfMs: number) {
    if (!this.utteranceId) {
      this.utteranceSeq += 1;
      this.utteranceId = `utt_${this.callId}_${this.utteranceSeq}`;
      this.startMs = perfMs;
      this.revision = Math.max(this.revision, 0);
    }
  }

  private cancelSettle() {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  private scheduleSettle(perfMs: number) {
    this.cancelSettle();
    const text = this.buffer.trim();
    if (!text || !this.utteranceId || this.startMs == null) return;
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.emitStableIfCurrent(perfMs);
    }, this.stabilizeMs);
  }

  private emitStableIfCurrent(triggerPerfMs: number) {
    const text = this.buffer.trim();
    if (!text || !this.utteranceId || this.startMs == null) return;
    if (this.revision === this.lastCommittedRevision) return;

    const stable: StableCallerUtterance = {
      utterance_id: this.utteranceId,
      revision: this.revision,
      start_ms: this.startMs,
      end_ms: this.lastEndMs || triggerPerfMs,
      stable_at: performance.now(),
      text,
    };

    this.lastCommittedRevision = this.revision;
    this.onStable(stable);

    this.utteranceId = null;
    this.startMs = null;
    this.buffer = "";
    this.revision = 0;
  }
}
