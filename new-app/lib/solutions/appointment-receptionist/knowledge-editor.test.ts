import { describe, expect, it } from "vitest";
import { mergeWizardStateForSave } from "./merge-wizard-state-on-save";
import type { AppointmentReceptionistWizardState } from "./types";
import { mapCrawlJobToCustomerView } from "../../voice/knowledge/website-crawl-customer-status";
import { customerSourceStatusLabel } from "../../voice/knowledge/source-status-label";
import { mirrorTimezoneFromBusinessSchedule } from "./knowledge-editor-timezone";

function fullCallHandlingState(): AppointmentReceptionistWizardState {
  return {
    agentId: "a1",
    transferDestinationPhone: "+15551234567",
    transferDestinationName: "Front desk",
    transferRingSeconds: 25,
    transferFallback: "voicemail",
    warmTransfer: true,
    voiceV2HumanTransferEnabled: true,
    urgencyEnabled: true,
    urgencyRules: [{ id: "u1", fieldId: "reason", match: "emergency", action: "transfer" }],
    callbackRequestsEnabled: true,
    afterHoursNotificationEvents: ["transfer_failed"],
    afterHoursNotificationRecipients: ["owner@example.com"],
    salesSolicitationEnabled: true,
    salesSolicitationAction: "block",
    spamLikelyPolicy: "warn",
    solicitorPolicy: "block",
    callRecording: "all",
    operatingMaturity: {
      revision: "v1",
      businessSchedule: {
        timezone: "America/Chicago",
        weekly: {
          monday: { closed: false, ranges: [{ start: "08:00", end: "17:00" }] },
          tuesday: { closed: true, ranges: [] },
          wednesday: { closed: true, ranges: [] },
          thursday: { closed: true, ranges: [] },
          friday: { closed: true, ranges: [] },
          saturday: { closed: true, ranges: [] },
          sunday: { closed: true, ranges: [] },
        },
        holidays: [],
      },
      onCallSchedule: {
        timezone: "America/Chicago",
        entries: [{ id: "oc1", label: "On call", phoneE164: "+15559876543" }],
      },
    },
    timezone: "America/New_York",
  } as AppointmentReceptionistWizardState;
}

describe("knowledge editor merge semantics", () => {
  it("merge preserves call-handling when saving information", () => {
    const server = fullCallHandlingState();
    const incoming = {
      ...server,
      businessName: "New Co",
      transferDestinationPhone: "+19999999999",
    };
    const merged = mergeWizardStateForSave(server, incoming, "information");
    expect(merged.businessName).toBe("New Co");
    expect(merged.transferDestinationPhone).toBe("+15551234567");
  });

  it("merge preserves full call-handling slice when saving business schedule only", () => {
    const server = fullCallHandlingState();
    const incoming = {
      ...server,
      operatingMaturity: {
        ...server.operatingMaturity!,
        businessSchedule: {
          ...server.operatingMaturity!.businessSchedule,
          timezone: "America/Los_Angeles",
        },
      },
    };
    const merged = mergeWizardStateForSave(server, incoming, "call-handling");

    expect(merged.operatingMaturity?.businessSchedule.timezone).toBe("America/Los_Angeles");
    expect(merged.transferDestinationPhone).toBe("+15551234567");
    expect(merged.transferDestinationName).toBe("Front desk");
    expect(merged.transferRingSeconds).toBe(25);
    expect(merged.transferFallback).toBe("voicemail");
    expect(merged.warmTransfer).toBe(true);
    expect(merged.voiceV2HumanTransferEnabled).toBe(true);
    expect(merged.urgencyEnabled).toBe(true);
    expect(merged.urgencyRules?.[0]?.id).toBe("u1");
    expect(merged.callbackRequestsEnabled).toBe(true);
    expect(merged.afterHoursNotificationEvents).toEqual(["transfer_failed"]);
    expect(merged.afterHoursNotificationRecipients).toEqual(["owner@example.com"]);
    expect(merged.salesSolicitationEnabled).toBe(true);
    expect(merged.salesSolicitationAction).toBe("block");
    expect(merged.spamLikelyPolicy).toBe("warn");
    expect(merged.solicitorPolicy).toBe("block");
    expect(merged.callRecording).toBe("all");
    expect(merged.operatingMaturity?.onCallSchedule.entries?.[0]?.phoneE164).toBe("+15559876543");
  });

  it("timezone mirror aligns state.timezone to businessSchedule.timezone", () => {
    const server = fullCallHandlingState();
    const mirrored = mirrorTimezoneFromBusinessSchedule(server);
    expect(mirrored.timezone).toBe("America/Chicago");
    expect(mirrored.operatingMaturity?.businessSchedule.timezone).toBe("America/Chicago");
  });
});

describe("website crawl customer mapping", () => {
  it("maps READY with suggestions to review_pending", () => {
    const view = mapCrawlJobToCustomerView({
      websiteUrl: "https://example.com",
      job: {
        status: "READY",
        suggestions: { businessName: "Acme", services: ["Plumbing"] },
        stats: { pagesIndexed: 3 },
      },
    });
    expect(view.searchable).toBe(true);
    expect(view.reviewCount).toBeGreaterThan(0);
  });
});

describe("source status labels", () => {
  it("does not label active as ready for search", () => {
    expect(customerSourceStatusLabel("active")).toBe("Waiting to process");
    expect(customerSourceStatusLabel("indexed")).toBe("Ready for search");
  });
});
