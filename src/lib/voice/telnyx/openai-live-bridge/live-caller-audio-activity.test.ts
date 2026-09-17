import { describe, expect, it } from "vitest";

import {
  CallerAudioActivityDetector,
  pcmuFrameRms,
  ulawByteToLinearSample,
} from "./live-caller-audio-activity";

function pcmuSilenceFrame(byteCount = 160): string {
  const buf = Buffer.alloc(byteCount, 0xff);
  return buf.toString("base64");
}

function pcmuLoudFrame(byteCount = 160): string {
  const buf = Buffer.alloc(byteCount);
  for (let i = 0; i < byteCount; i++) {
    buf[i] = i % 2 === 0 ? 0x00 : 0x7f;
  }
  return buf.toString("base64");
}

describe("live-caller-audio-activity", () => {
  it("decodes ulaw samples", () => {
    expect(ulawByteToLinearSample(0xff)).toBe(0);
  });

  it("detects speech start and end estimate", () => {
    const det = new CallerAudioActivityDetector({
      speechRmsThreshold: 100,
      silenceFramesForEnd: 3,
    });
    let t = 1000;
    expect(det.processFrame(pcmuSilenceFrame(), t)).toEqual([]);
    t += 20;
    const start = det.processFrame(pcmuLoudFrame(), t);
    expect(start.some((e) => e.type === "CALLER_AUDIO_STARTED")).toBe(true);
    t += 20;
    for (let i = 0; i < 3; i++) {
      const end = det.processFrame(pcmuSilenceFrame(), t);
      if (i === 2) {
        expect(end.some((e) => e.type === "CALLER_AUDIO_ENDED_ESTIMATE")).toBe(true);
      }
      t += 20;
    }
  });

  it("loud frame has higher RMS than silence", () => {
    expect(pcmuFrameRms(pcmuLoudFrame())).toBeGreaterThan(pcmuFrameRms(pcmuSilenceFrame()));
  });
});
