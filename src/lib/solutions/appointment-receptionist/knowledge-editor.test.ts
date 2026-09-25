import { describe, expect, it } from "vitest";
import { mergeWizardStateForSave } from "./merge-wizard-state-on-save";
import type { AppointmentReceptionistWizardState } from "./types";
import { mapCrawlJobToCustomerView } from "../../voice/knowledge/website-crawl-customer-status";
import { customerSourceStatusLabel } from "../../voice/knowledge/source-status-label";

function callHandlingState(): AppointmentReceptionistWizardState {
  return {
    agentId: "a1",
    transferDestinationPhone: "+15551234567",
    urgencyEnabled: true,
    callbackRequestsEnabled: true,
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
      onCallSchedule: { timezone: "America/Chicago", entries: [] },
    },
    timezone: "America/New_York",
  } as AppointmentReceptionistWizardState;
}

describe("knowledge editor merge semantics", () => {
  it("merge preserves call-handling when saving information", () => {
    const server = callHandlingState();
    const incoming = {
      ...server,
      businessName: "New Co",
      transferDestinationPhone: "+19999999999",
    };
    const merged = mergeWizardStateForSave(server, incoming, "information");
    expect(merged.businessName).toBe("New Co");
    expect(merged.transferDestinationPhone).toBe("+15551234567");
  });

  it("merge preserves appointments when saving call-handling schedule", () => {
    const server = {
      ...callHandlingState(),
      collectFields: [{ id: "phone", label: "Phone", required: true, enabled: true }],
    };
    const incoming = {
      ...server,
      operatingMaturity: {
        ...server.operatingMaturity!,
        businessSchedule: {
          ...server.operatingMaturity!.businessSchedule,
          timezone: "America/Los_Angeles",
        },
      },
      collectFields: [{ id: "email", label: "Email", required: false, enabled: true }],
    };
    const merged = mergeWizardStateForSave(server, incoming, "call-handling");
    expect(merged.operatingMaturity?.businessSchedule.timezone).toBe("America/Los_Angeles");
    expect(merged.collectFields?.[0]?.id).toBe("phone");
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
