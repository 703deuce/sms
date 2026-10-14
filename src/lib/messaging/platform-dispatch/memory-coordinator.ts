import {
  platformDispatchDefaultDeferMs,
  platformDispatchMps,
} from "@/lib/messaging/platform-dispatch/config";
import { PlatformDispatchDeferredError } from "@/lib/messaging/platform-dispatch/errors";
import {
  isInteractivePlatformDispatchPriority,
  platformDispatchPriorityFromScore,
  platformDispatchScore,
} from "@/lib/messaging/platform-dispatch/priority";

type Waiter = {
  reservationId: string;
  score: number;
  notBeforeMs: number;
  priority: number;
};

type E164State = {
  waiters: Map<string, Waiter>;
  rateBySecond: Map<number, number>;
  fifoSequence: number;
};

const byE164 = new Map<string, E164State>();
let lock: Promise<void> = Promise.resolve();

function withLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const run = lock.then(() => fn());
  lock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function stateFor(e164: string): E164State {
  const key = e164;
  let s = byE164.get(key);
  if (!s) {
    s = { waiters: new Map(), rateBySecond: new Map(), fifoSequence: 0 };
    byE164.set(key, s);
  }
  return s;
}

function tryAcquireOnce(
  e164: string,
  input: {
    reservationId: string;
    priority: number;
    notBeforeMs: number;
  },
): { ok: true } | { ok: false; reason: string; deferMs: number } {
  const now = Date.now();
  if (now < input.notBeforeMs) {
    return {
      ok: false,
      reason: "not_before",
      deferMs: Math.min(input.notBeforeMs - now, platformDispatchDefaultDeferMs()),
    };
  }

  const st = stateFor(e164);
  if (!st.waiters.has(input.reservationId)) {
    st.fifoSequence += 1;
    const score = platformDispatchScore(input.priority, st.fifoSequence);
    st.waiters.set(input.reservationId, {
      reservationId: input.reservationId,
      score,
      notBeforeMs: input.notBeforeMs,
      priority: input.priority,
    });
  }

  const ordered = [...st.waiters.values()].sort((a, b) => a.score - b.score);
  const head = ordered[0];
  if (!head || head.reservationId !== input.reservationId) {
    return { ok: false, reason: "not_head", deferMs: platformDispatchDefaultDeferMs() };
  }

  const myPriority = platformDispatchPriorityFromScore(head.score);
  if (!isInteractivePlatformDispatchPriority(myPriority)) {
    const interactiveDue = ordered.some((w) => {
      if (w.reservationId === input.reservationId) return false;
      const p = platformDispatchPriorityFromScore(w.score);
      return isInteractivePlatformDispatchPriority(p) && now >= w.notBeforeMs && p < myPriority;
    });
    if (interactiveDue) {
      return { ok: false, reason: "interactive_waiting", deferMs: platformDispatchDefaultDeferMs() };
    }
  }

  const second = Math.floor(now / 1000);
  const used = st.rateBySecond.get(second) ?? 0;
  const mps = platformDispatchMps();
  if (used >= mps) {
    return { ok: false, reason: "rate", deferMs: 250 };
  }
  st.rateBySecond.set(second, used + 1);
  st.waiters.delete(input.reservationId);
  return { ok: true };
}

export async function acquirePlatformDispatchSlotMemory(input: {
  platformE164: string;
  reservationId: string;
  priority: number;
  notBeforeMs?: number;
  enqueueMs?: number;
  maxWaitMs: number;
}): Promise<void> {
  const notBeforeMs = input.notBeforeMs ?? Date.now();
  const deadline = Date.now() + input.maxWaitMs;

  while (true) {
    const outcome = await withLock(() =>
      tryAcquireOnce(input.platformE164, {
        reservationId: input.reservationId,
        priority: input.priority,
        notBeforeMs,
      }),
    );
    if (outcome.ok) return;
    if (Date.now() >= deadline) {
      throw new PlatformDispatchDeferredError(outcome.reason, outcome.deferMs);
    }
    await new Promise((r) => setTimeout(r, 15));
  }
}

export function resetPlatformDispatchMemoryForTests() {
  byE164.clear();
  lock = Promise.resolve();
}
