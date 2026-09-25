import { describe, expect, it } from "vitest";
import {
  buildOverviewAttentionRows,
  deriveOverviewPublicationStatus,
} from "./overview-summary-present";

describe("deriveOverviewPublicationStatus", () => {
  it("returns setup_required without agent", () => {
    expect(
      deriveOverviewPublicationStatus({
        hasCanonicalAgent: false,
        published: false,
        agentStatus: null,
      }),
    ).toBe("setup_required");
  });

  it("returns draft when unpublished", () => {
    expect(
      deriveOverviewPublicationStatus({
        hasCanonicalAgent: true,
        published: false,
        agentStatus: "ACTIVE",
      }),
    ).toBe("draft");
  });

  it("returns active when published and ACTIVE", () => {
    expect(
      deriveOverviewPublicationStatus({
        hasCanonicalAgent: true,
        published: true,
        agentStatus: "ACTIVE",
      }),
    ).toBe("active");
  });
});

describe("buildOverviewAttentionRows", () => {
  it("aggregates voice calls and knowledge gaps", () => {
    const rows = buildOverviewAttentionRows({
      voiceCallsNeedingAttention: 2,
      openKnowledgeGaps: 1,
      blockingSetupIssues: [],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].href).toBe("/voice/calls?attention=open");
    expect(rows[1].href).toBe("/voice/knowledge#knowledge-gaps");
  });
});
