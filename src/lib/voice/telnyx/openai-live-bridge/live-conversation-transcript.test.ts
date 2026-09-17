import { describe, expect, it } from "vitest";

import { LiveConversationTranscript } from "./live-conversation-transcript";
import { buildDelegationDeveloperText } from "./live-delegation-context";
import type { LiveControlPlane } from "./live-control-plane";

describe("LiveConversationTranscript", () => {
  it("formats transcript since last delegation checkpoint", () => {
    const t = new LiveConversationTranscript();
    t.appendDelta("amy", "Hello, ");
    t.appendDelta("amy", "how can I help?");
    t.appendDelta("caller", "I need Thursday at 10.");
    t.markDelegationCheckpoint();
    t.appendDelta("caller", "Actually 11.");
    const chunk = t.formatSinceLastDelegation();
    expect(chunk).toContain("Caller: Actually 11.");
    expect(chunk).not.toContain("Hello");
  });

  it("buildDelegationDeveloperText includes transcript and scheduling JSON", () => {
    const t = new LiveConversationTranscript();
    t.appendDelta("caller", "My wife prefers mornings.");
    const controlPlane = {
      getWorkflowEnvelope: () => ({
        voice_v2_next_stage: "COLLECT_REQUIRED_INTAKE",
        allowed_next_actions: ["voice_v2_save_intake_fields"],
      }),
      getCallContext: () => null,
    } as unknown as LiveControlPlane;
    const text = buildDelegationDeveloperText({
      transcript: t,
      controlPlane,
      isFirstDelegation: true,
    });
    expect(text).toContain("wife prefers mornings");
    expect(text).toContain("workflow control plane");
    expect(text).toContain("voice_v2_next_stage");
  });
});
