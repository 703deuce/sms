/**
 * Diagnostic caller speech activity from inbound PCMU (μ-law) frames.
 * Not a replacement for GPT-Live VAD — measurement only.
 */

const ULAW_BIAS = 0x84;

/** Decode one μ-law byte to 16-bit linear PCM (ITU-T G.711). */
export function ulawByteToLinearSample(ulaw: number): number {
  let u = (~ulaw) & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  let sample = ((mantissa << 3) + ULAW_BIAS) << exponent;
  sample -= ULAW_BIAS;
  return sign ? -sample : sample;
}

export type CallerAudioActivityConfig = {
  /** RMS linear sample magnitude above this ⇒ speech (tuned for 8 kHz PSTN). */
  speechRmsThreshold?: number;
  /** Consecutive sub-threshold frames ⇒ caller audio ended estimate (~20 ms/frame). */
  silenceFramesForEnd?: number;
};

const DEFAULT_SPEECH_RMS = 280;
const DEFAULT_SILENCE_FRAMES = 15; // ~300 ms at 20 ms/frame

export type CallerAudioActivityEvent =
  | { type: "CALLER_AUDIO_STARTED"; perfMs: number }
  | { type: "CALLER_AUDIO_ENDED_ESTIMATE"; perfMs: number };

export function pcmuFrameRms(base64Payload: string): number {
  const buf = Buffer.from(base64Payload, "base64");
  if (buf.length === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < buf.length; i++) {
    const s = ulawByteToLinearSample(buf[i]);
    sumSq += s * s;
  }
  return Math.sqrt(sumSq / buf.length);
}

export class CallerAudioActivityDetector {
  private readonly speechRmsThreshold: number;
  private readonly silenceFramesForEnd: number;
  private callerSpeaking = false;
  private subThresholdFrames = 0;

  constructor(config?: CallerAudioActivityConfig) {
    this.speechRmsThreshold = config?.speechRmsThreshold ?? DEFAULT_SPEECH_RMS;
    this.silenceFramesForEnd = config?.silenceFramesForEnd ?? DEFAULT_SILENCE_FRAMES;
  }

  /** Process one inbound Telnyx media payload; returns edge events this frame. */
  processFrame(base64Payload: string, perfMs: number): CallerAudioActivityEvent[] {
    const events: CallerAudioActivityEvent[] = [];
    const rms = pcmuFrameRms(base64Payload);
    const isSpeech = rms >= this.speechRmsThreshold;

    if (isSpeech) {
      this.subThresholdFrames = 0;
      if (!this.callerSpeaking) {
        this.callerSpeaking = true;
        events.push({ type: "CALLER_AUDIO_STARTED", perfMs });
      }
      return events;
    }

    if (!this.callerSpeaking) {
      return events;
    }

    this.subThresholdFrames += 1;
    if (this.subThresholdFrames >= this.silenceFramesForEnd) {
      this.callerSpeaking = false;
      this.subThresholdFrames = 0;
      events.push({ type: "CALLER_AUDIO_ENDED_ESTIMATE", perfMs });
    }
    return events;
  }

  get isCallerSpeaking(): boolean {
    return this.callerSpeaking;
  }
}
