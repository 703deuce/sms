import "server-only";

type MailboxSlot = {
  active: number;
  queue: Array<() => void>;
};

const mailboxes = new Map<string, MailboxSlot>();

function maxConcurrentPerMailbox(): number {
  const raw = process.env.MICROSOFT_GRAPH_MAILBOX_CONCURRENCY?.trim();
  const parsed = raw ? Number(raw) : 4;
  if (!Number.isFinite(parsed) || parsed < 1) return 4;
  return Math.min(Math.floor(parsed), 8);
}

function globalMaxConcurrent(): number {
  const raw = process.env.MICROSOFT_GRAPH_GLOBAL_CONCURRENCY?.trim();
  const parsed = raw ? Number(raw) : 32;
  if (!Number.isFinite(parsed) || parsed < 4) return 32;
  return Math.min(Math.floor(parsed), 128);
}

let globalActive = 0;
const globalQueue: Array<() => void> = [];

function drainGlobal() {
  while (globalActive < globalMaxConcurrent() && globalQueue.length) {
    globalActive += 1;
    const next = globalQueue.shift();
    next?.();
  }
}

function withGlobal<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      fn()
        .then(resolve, reject)
        .finally(() => {
          globalActive -= 1;
          drainGlobal();
        });
    };
    if (globalActive < globalMaxConcurrent()) {
      globalActive += 1;
      run();
    } else {
      globalQueue.push(run);
    }
  });
}

function drainMailbox(key: string, slot: MailboxSlot) {
  while (slot.active < maxConcurrentPerMailbox() && slot.queue.length) {
    slot.active += 1;
    const next = slot.queue.shift();
    next?.();
  }
}

/** Limit concurrent Graph calls per Microsoft mailbox (connection). */
export async function withMicrosoftMailboxGraphLimit<T>(
  connectionId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const key = connectionId;
  let slot = mailboxes.get(key);
  if (!slot) {
    slot = { active: 0, queue: [] };
    mailboxes.set(key, slot);
  }

  return withGlobal(() =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            slot!.active -= 1;
            drainMailbox(key, slot!);
          });
      };
      if (slot!.active < maxConcurrentPerMailbox()) {
        slot!.active += 1;
        run();
      } else {
        slot!.queue.push(run);
      }
    }),
  );
}

export async function sleepForGraphRetryAfter(res: Response): Promise<void> {
  if (res.status !== 429 && res.status < 500) return;
  const retryAfter = res.headers.get("Retry-After");
  let ms = 2_000;
  if (retryAfter) {
    const sec = Number(retryAfter);
    if (Number.isFinite(sec)) ms = Math.min(sec * 1000, 120_000);
    else {
      const date = Date.parse(retryAfter);
      if (!Number.isNaN(date)) ms = Math.min(Math.max(0, date - Date.now()), 120_000);
    }
  }
  const jitter = Math.floor(Math.random() * 500);
  await new Promise((r) => setTimeout(r, ms + jitter));
}
