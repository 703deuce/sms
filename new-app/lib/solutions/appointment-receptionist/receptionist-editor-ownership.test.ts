import { describe, expect, it } from "vitest";
import { mergeWizardStateForSave } from "./merge-wizard-state-on-save";
import {
  computeDirtyGroups,
  ownershipGroupsForPatch,
} from "./receptionist-editor-ownership";
import type { AppointmentReceptionistWizardState } from "./types";

function fullState(): AppointmentReceptionistWizardState {
  return {
    agentId: "agent_test",
    agentName: "Amy",
    voiceId: "alloy",
    voiceLabel: "Alloy",
    openingGreeting: "Hello",
    capabilities: ["answer_questions", "book_appointments"],
    collectFields: [{ id: "phone", label: "Phone", required: true, enabled: true }],
    transferDestinationPhone: "+15551234567",
  } as AppointmentReceptionistWizardState;
}

describe("receptionist-editor-ownership", () => {
  it("maps patch keys to ownership groups", () => {
    expect(ownershipGroupsForPatch({ agentName: "X" })).toContain("information");
    expect(ownershipGroupsForPatch({ voiceId: "nova" })).toContain("voice");
    expect(ownershipGroupsForPatch({ collectFields: [] })).toContain("appointments");
    expect(ownershipGroupsForPatch({ callbackRequestsEnabled: false })).toContain(
      "callHandling",
    );
  });

  it("detects dirty groups independently", () => {
    const base = fullState();
    const edited = { ...base, agentName: "Maya" };
    const dirty = computeDirtyGroups(edited, base);
    expect(dirty.has("information")).toBe(true);
    expect(dirty.has("voice")).toBe(false);
  });

  it("merge preserves information when saving voice step", () => {
    const server = fullState();
    const incoming = {
      ...server,
      voiceId: "shimmer",
      agentName: "Overwritten",
    };
    const merged = mergeWizardStateForSave(server, incoming, "voice");
    expect(merged.voiceId).toBe("shimmer");
    expect(merged.agentName).toBe("Amy");
  });

  it("merge preserves voice when saving information step", () => {
    const server = fullState();
    const incoming = {
      ...server,
      agentName: "Maya",
      voiceId: "overwritten",
    };
    const merged = mergeWizardStateForSave(server, incoming, "information");
    expect(merged.agentName).toBe("Maya");
    expect(merged.voiceId).toBe("alloy");
  });

  it("merge preserves call handling when saving appointments", () => {
    const server = {
      ...fullState(),
      transferDestinationPhone: "+15551234567",
    };
    const incoming = {
      ...server,
      collectFields: [{ id: "phone", label: "Phone", required: true, enabled: true }],
      transferDestinationPhone: "+19999999999",
    };
    const merged = mergeWizardStateForSave(server, incoming, "appointments");
    expect(merged.transferDestinationPhone).toBe("+15551234567");
  });
});
