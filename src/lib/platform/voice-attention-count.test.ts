import { describe, expect, it } from "vitest";
import { isVoiceCallsAttentionKind } from "./voice-attention-kinds";

describe("Voice attention kind isolation", () => {
  it("includes voice callback and failed transfer", () => {
    expect(isVoiceCallsAttentionKind("callback_request")).toBe(true);
    expect(isVoiceCallsAttentionKind("failed_transfer")).toBe(true);
    expect(isVoiceCallsAttentionKind("voicemail")).toBe(true);
  });

  it("excludes MCTB kinds", () => {
    expect(isVoiceCallsAttentionKind("mctb_reply")).toBe(false);
    expect(isVoiceCallsAttentionKind("missed_call")).toBe(false);
  });
});
