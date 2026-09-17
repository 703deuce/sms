import { describe, expect, it } from "vitest";

import {
  filterLiveToolsForWorkflow,
  shouldIssueResponseCreateOnDelegation,
} from "./live-workflow-tool-filter";
import { buildVoiceV2CallCapabilitySnapshot } from "@/lib/voice-v2/workflow-capability";

describe("live workflow tool filter", () => {
  it("filters tools to allowed workflow actions only", () => {
    const capability = buildVoiceV2CallCapabilitySnapshot({
      advanced: { appointmentReceptionistWizard: { bookingStrategy: "MICROSOFT_365" } },
    } as never);
    const tools = filterLiveToolsForWorkflow({
      config: { advanced: {} } as never,
      capability,
      allowedActions: ["voice_v2_find_availability"],
    });
    expect(tools.map((t) => t.name)).toEqual(["voice_v2_find_availability"]);
  });

  it("does not proactive response.create after BOOKING_CONFIRMED", () => {
    expect(shouldIssueResponseCreateOnDelegation("BOOKING_CONFIRMED", [])).toBe(false);
    expect(
      shouldIssueResponseCreateOnDelegation("OFFER_SLOTS", ["voice_v2_book_offered_slot"]),
    ).toBe(true);
  });
});
