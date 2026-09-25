import { describe, expect, it, vi } from "vitest";
import {
  resolveVoiceKnowledgeGapWithIndexingCore,
  type ResolveGapIndexingDeps,
} from "./resolve-gap-with-indexing-core";

const baseInput = {
  workspaceId: "ws1",
  gapId: "gap1",
  knowledgeBaseId: "kb1",
  question: "Do you offer financing?",
  answerText: "Yes, we offer financing options.",
};

function deps(overrides: Partial<ResolveGapIndexingDeps>): ResolveGapIndexingDeps {
  return {
    findKnowledgeBase: vi.fn().mockResolvedValue({ id: "kb1" }),
    findGap: vi.fn().mockResolvedValue({ id: "gap1", status: "OPEN" }),
    createPendingSource: vi.fn().mockResolvedValue({ id: "src1" }),
    processKnowledgeSource: vi.fn().mockResolvedValue(undefined),
    getSourceStatus: vi.fn().mockResolvedValue({ status: "indexed", errorMessage: null }),
    markGapResolved: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("resolveVoiceKnowledgeGapWithIndexingCore", () => {
  it("success: creates source, processes, verifies indexed, then resolves gap", async () => {
    const d = deps({});
    const result = await resolveVoiceKnowledgeGapWithIndexingCore(baseInput, d);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.sourceId).toBe("src1");

    expect(d.createPendingSource).toHaveBeenCalledOnce();
    expect(d.processKnowledgeSource).toHaveBeenCalledWith("src1");
    expect(d.getSourceStatus).toHaveBeenCalledWith("src1");
    expect(d.markGapResolved).toHaveBeenCalledWith("ws1", "gap1");

    const processOrder = d.processKnowledgeSource.mock.invocationCallOrder[0];
    const resolveOrder = d.markGapResolved.mock.invocationCallOrder[0];
    expect(processOrder).toBeLessThan(resolveOrder);
  });

  it("processor failure: does not mark gap resolved", async () => {
    const d = deps({
      processKnowledgeSource: vi.fn().mockRejectedValue(new Error("index failed")),
    });
    const result = await resolveVoiceKnowledgeGapWithIndexingCore(baseInput, d);

    expect(result.ok).toBe(false);
    expect(d.markGapResolved).not.toHaveBeenCalled();
    expect(result.sourceId).toBe("src1");
  });

  it("non-indexed status after process: does not mark gap resolved", async () => {
    const d = deps({
      getSourceStatus: vi.fn().mockResolvedValue({ status: "failed", errorMessage: "embed error" }),
    });
    const result = await resolveVoiceKnowledgeGapWithIndexingCore(baseInput, d);

    expect(result.ok).toBe(false);
    expect(d.markGapResolved).not.toHaveBeenCalled();
    expect(result.error).toContain("embed");
  });
});
