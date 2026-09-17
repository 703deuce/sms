import { describe, expect, it } from "vitest";

import { createLiveBookingSessionState } from "./live-booking-session-state";
import { LiveConversationTranscript } from "./live-conversation-transcript";
import { buildDelegationDeveloperText } from "./live-delegation-context";

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
    const text = buildDelegationDeveloperText({
      transcript: t,
      bookingSession: createLiveBookingSessionState(),
      isFirstDelegation: true,
    });
    expect(text).toContain("wife prefers mornings");
    expect(text).toContain("Authoritative structured scheduling state");
    expect(text).toContain("current_offer_set");
  });
});
