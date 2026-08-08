import { AudioFrame } from "@livekit/rtc-node";
import { AudioOutput } from "@livekit/agents";
import { gainDbToLinear, normalizeOutputGainDb } from "@/lib/voice/pstn-audio";

function applyGainToFrame(frame: AudioFrame, linearGain: number): AudioFrame {
  if (linearGain === 1) return frame;

  const scaled = new Int16Array(frame.data.length);
  for (let i = 0; i < frame.data.length; i++) {
    const sample = Math.round(frame.data[i]! * linearGain);
    scaled[i] = Math.max(-32768, Math.min(32767, sample));
  }

  return new AudioFrame(
    scaled,
    frame.sampleRate,
    frame.channels,
    frame.samplesPerChannel,
  );
}

/**
 * Attenuates agent TTS before it reaches the SIP participant.
 * Chains onto the existing RoomIO audio output (same pattern as RecorderAudioOutput).
 */
class GainAudioOutput extends AudioOutput {
  constructor(
    private readonly linearGain: number,
    downstream: AudioOutput,
  ) {
    super(downstream.sampleRate, downstream, { pause: downstream.canPause });
  }

  async captureFrame(frame: AudioFrame): Promise<void> {
    await super.captureFrame(frame);
    if (!this.nextInChain) return;
    await this.nextInChain.captureFrame(applyGainToFrame(frame, this.linearGain));
  }

  flush(): void {
    super.flush();
    this.nextInChain?.flush();
  }

  clearBuffer(): void {
    this.nextInChain?.clearBuffer();
  }

  abandonOpenSegment(): void {
    super.abandonOpenSegment();
    this.nextInChain?.abandonOpenSegment();
  }

  pause(): void {
    this.nextInChain?.pause();
    super.pause();
  }

  resume(): void {
    this.nextInChain?.resume();
    super.resume();
  }
}

export function resolveLiveKitOutputGainDb(raw?: unknown): number {
  const env = process.env.VOICE_AGENT_OUTPUT_GAIN_DB?.trim();
  if (env) return normalizeOutputGainDb(Number(env));
  if (raw != null) return normalizeOutputGainDb(raw);
  return -4;
}

export function attachOutputGain(
  audioOutput: AudioOutput | null | undefined,
  gainDb: number,
): AudioOutput | null | undefined {
  if (!audioOutput) return audioOutput;
  const linear = gainDbToLinear(gainDb);
  if (linear === 1) return audioOutput;
  return new GainAudioOutput(linear, audioOutput);
}
