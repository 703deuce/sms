import { describe, expect, it } from "vitest";

import { createPendingStableUtteranceQueue } from "./live-pending-stable-utterances";
import type { StableCallerUtterance } from "./live-caller-utterance-assembler";

function utterance(id: string, revision: number): StableCallerUtterance {
  return {
    utterance_id: id,
    revision,
    start_ms: 0,
    end_ms: 100,
    stable_at: Date.now(),
    text: `text-${id}-r${revision}`,
  };
}

describe("live-pending-stable-utterances", () => {
  it("queues and drains in order before control plane is ready", () => {
    const q = createPendingStableUtteranceQueue();
    q.enqueue(utterance("u1", 1));
    q.enqueue(utterance("u2", 1));
    expect(q.size()).toBe(2);
    const drained = q.drain();
    expect(drained.map((u) => u.utterance_id)).toEqual(["u1", "u2"]);
    expect(q.size()).toBe(0);
  });
});
