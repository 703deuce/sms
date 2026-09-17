import type { StableCallerUtterance } from "./live-caller-utterance-assembler";

export type PendingStableUtteranceQueue = {
  enqueue: (utterance: StableCallerUtterance) => void;
  drain: () => StableCallerUtterance[];
  size: () => number;
};

export function createPendingStableUtteranceQueue(): PendingStableUtteranceQueue {
  const pending: StableCallerUtterance[] = [];
  return {
    enqueue(u) {
      pending.push(u);
    },
    drain() {
      return pending.splice(0, pending.length);
    },
    size() {
      return pending.length;
    },
  };
}
