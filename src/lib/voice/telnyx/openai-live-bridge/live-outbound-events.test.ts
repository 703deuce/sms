import { describe, expect, it } from "vitest";

import {
  assertLiveOutboundEventContract,
  buildLiveCommentaryAppend,
  buildLiveDelegationDeveloperContextItem,
  buildLiveFunctionCallOutputItem,
  buildLiveInstructionsAppend,
  buildLiveResponseCreate,
  buildLiveThinkingAppend,
} from "./live-outbound-events";

describe("live-outbound-events API contract", () => {
  it("response.item.create and response.create never include delegation_id", () => {
    const item = buildLiveDelegationDeveloperContextItem({ developerText: "ctx" });
    expect(item).not.toHaveProperty("delegation_id");
    expect(item.type).toBe("response.item.create");

    const toolOut = buildLiveFunctionCallOutputItem({
      callId: "call_abc",
      output: "{}",
    });
    expect(toolOut).not.toHaveProperty("delegation_id");

    const create = buildLiveResponseCreate();
    expect(create).not.toHaveProperty("delegation_id");
    expect(create.type).toBe("response.create");

    assertLiveOutboundEventContract(item as Record<string, unknown>);
    assertLiveOutboundEventContract(toolOut as Record<string, unknown>);
    assertLiveOutboundEventContract(create as Record<string, unknown>);
  });

  it("session.*.append events require delegation_id", () => {
    const instr = buildLiveInstructionsAppend({ content: "authority" });
    expect(instr).toHaveProperty("delegation_id", null);

    const think = buildLiveThinkingAppend({ content: "checking" });
    expect(think).toHaveProperty("delegation_id", null);

    const comment = buildLiveCommentaryAppend({ content: "still working" });
    expect(comment).toHaveProperty("delegation_id", null);

    assertLiveOutboundEventContract(instr as Record<string, unknown>);
    assertLiveOutboundEventContract(think as Record<string, unknown>);
    assertLiveOutboundEventContract(comment as Record<string, unknown>);
  });

  it("rejects delegation_id on forbidden event types", () => {
    expect(() =>
      assertLiveOutboundEventContract({
        type: "response.item.create",
        delegation_id: "x",
        item: {},
      }),
    ).toThrow(/must not include delegation_id/);

    expect(() =>
      assertLiveOutboundEventContract({
        type: "response.create",
        delegation_id: null,
      }),
    ).toThrow(/must not include delegation_id/);
  });
});
