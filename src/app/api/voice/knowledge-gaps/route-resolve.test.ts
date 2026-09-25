import { describe, expect, it, vi, beforeEach } from "vitest";

const resolveMock = vi.fn();

vi.mock("@/lib/voice-v3/knowledge-gaps/resolve-gap-with-indexing", () => ({
  resolveVoiceKnowledgeGapWithIndexing: (...args: unknown[]) => resolveMock(...args),
}));

vi.mock("@/lib/voice-v3/knowledge-gaps/owner-service", () => ({
  listVoiceKnowledgeGaps: vi.fn().mockResolvedValue([
    {
      id: "gap1",
      displayQuestion: "Hours?",
      normalizedQuestion: "hours",
      status: "OPEN",
      timesAsked: 1,
      firstAskedAt: new Date().toISOString(),
      lastAskedAt: new Date().toISOString(),
      recentWording: null,
      sourceCallIds: [],
    },
  ]),
  updateVoiceKnowledgeGapStatus: vi.fn(),
}));

vi.mock("@/lib/voice/permissions", () => ({
  requireVoicePermission: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/api-auth", () => ({
  requireSession: vi.fn().mockResolvedValue({
    session: { userId: "u1" },
    workspaceId: "ws1",
  }),
  jsonError: (err: unknown, status: number) =>
    new Response(JSON.stringify({ error: String(err) }), { status }),
}));

describe("PATCH /api/voice/knowledge-gaps resolve path", () => {
  beforeEach(() => {
    resolveMock.mockReset();
  });

  it("returns 422 when indexing orchestration fails (gap stays OPEN server-side)", async () => {
    resolveMock.mockResolvedValue({ ok: false, error: "index failed", sourceId: "src1" });
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/voice/knowledge-gaps", {
        method: "PATCH",
        body: JSON.stringify({
          id: "gap1",
          status: "RESOLVED",
          answerText: "9 to 5",
          knowledgeBaseId: "kb1",
        }),
      }),
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.gapStatus).toBe("OPEN");
    expect(body.error).toContain("index failed");
  });

  it("returns ok when indexing succeeds", async () => {
    resolveMock.mockResolvedValue({ ok: true, sourceId: "src1" });
    const { PATCH } = await import("./route");
    const res = await PATCH(
      new Request("http://localhost/api/voice/knowledge-gaps", {
        method: "PATCH",
        body: JSON.stringify({
          id: "gap1",
          status: "RESOLVED",
          answerText: "9 to 5",
          knowledgeBaseId: "kb1",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.indexed).toBe(true);
  });
});
