/**
 * Adaptive DataForSEO Maps Priority submission scheduler.
 *
 * - Solo scan (nothing else waiting): fill each POST up to 100 tasks.
 * - Contended (other maps waiting): take 25-cell slices round-robin so a
 *   large map cannot monopolize the wire ahead of a small one.
 *
 * POSTs are paced 50–100ms apart and never wait for task completion.
 */

import {
  dataForSeoMapsAppChunkSize,
  dataForSeoMapsMaxTasksPerPost,
  dataForSeoMapsPostDelayMaxMs,
  dataForSeoMapsPostDelayMinMs,
} from "@/lib/providers/maps-grid/config";
import type { MapsLiveRequestPayload } from "@/lib/providers/dataforseo/build-maps-request";
import type { JobPriorityClass } from "@/lib/queue/types";

/** App-level submit priority (1 = user waiting, 4 = retries). */
export type MapsSubmitPriority = 1 | 2 | 3 | 4;

export function mapsSubmitPriorityFromJob(
  priority?: JobPriorityClass | MapsSubmitPriority | string | number | null
): MapsSubmitPriority {
  if (priority === 1 || priority === "highest" || priority === "active") return 1;
  if (priority === 2 || priority === "normal" || priority === "paid") return 2;
  if (priority === 3 || priority === "scheduled" || priority === "background") return 3;
  if (priority === 4 || priority === "lower" || priority === "retry") return 4;
  return 2;
}

export type MapsPriorityRequest = MapsLiveRequestPayload & { priority: number };

export type PreparedMapsPriorityRow = {
  tag: string;
  body: Record<string, unknown>;
  request: MapsPriorityRequest;
};

export type PostedMapsPriorityRow = {
  tag: string;
  taskId: string;
  request: MapsPriorityRequest;
};

export type FairQueueChunk = {
  scanKey: string;
  priority: MapsSubmitPriority;
  organizationId?: string;
  rows: PreparedMapsPriorityRow[];
};

export type PostOneMapsPriorityFn = (
  rows: PreparedMapsPriorityRow[],
  organizationId?: string
) => Promise<PostedMapsPriorityRow[]>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postDelayMs(): number {
  const min = dataForSeoMapsPostDelayMinMs();
  const max = dataForSeoMapsPostDelayMaxMs();
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Brief wait so a second scan can join before we fill a solo 100-task POST. */
export function dataForSeoMapsCoalesceMs(): number {
  const n = Number(process.env.DATAFORSEO_MAPS_COALESCE_MS ?? 25);
  if (!Number.isFinite(n) || n < 0) return 25;
  return Math.min(500, Math.floor(n));
}

/** @deprecated Prefer adaptive packing — kept for tests / callers that pre-slice. */
export function chunkPreparedMapsRows<T>(
  rows: T[],
  chunkSize = dataForSeoMapsAppChunkSize()
): T[][] {
  const size = Math.max(1, Math.min(chunkSize, dataForSeoMapsMaxTasksPerPost()));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    out.push(rows.slice(i, i + size));
  }
  return out;
}

export type PackSlice = {
  scanKey: string;
  priority: MapsSubmitPriority;
  organizationId?: string;
  /** Row indices into that scan's remaining queue at pack time — callers use rows. */
  rows: PreparedMapsPriorityRow[];
};

/**
 * Decide take size: full POST when only one scan is waiting, else fair 25.
 */
export function mapsPriorityTakeSize(contended: boolean): number {
  const max = dataForSeoMapsMaxTasksPerPost();
  if (!contended) return max;
  return Math.max(1, Math.min(dataForSeoMapsAppChunkSize(), max));
}

/**
 * Pure packer.
 *
 * Solo scan → fill up to maxTasks from that scan (no artificial 25-split).
 * Multiple scans → round-robin slices of appChunkSize (default 25).
 * Same organizationId only (cost attribution).
 */
export function packFairMapsPostPayload(
  pending: FairQueueChunk[],
  opts?: { maxTasksPerPost?: number; startScanIndex?: number; fairChunkSize?: number }
): { selected: FairQueueChunk[]; nextScanIndex: number; contended: boolean; takeSize: number } {
  if (!pending.length) {
    return { selected: [], nextScanIndex: 0, contended: false, takeSize: dataForSeoMapsMaxTasksPerPost() };
  }

  const maxTasks = opts?.maxTasksPerPost ?? dataForSeoMapsMaxTasksPerPost();
  const fairChunk = opts?.fairChunkSize ?? dataForSeoMapsAppChunkSize();
  const bestPriority = Math.min(...pending.map((c) => c.priority)) as MapsSubmitPriority;
  const tier = pending.filter((c) => c.priority === bestPriority);

  const orgCounts = new Map<string, number>();
  for (const c of tier) {
    const key = c.organizationId ?? "";
    orgCounts.set(key, (orgCounts.get(key) ?? 0) + c.rows.length);
  }
  let orgKey = "";
  let orgBest = -1;
  for (const [k, n] of orgCounts) {
    if (n > orgBest) {
      orgBest = n;
      orgKey = k;
    }
  }
  const orgTier = tier.filter((c) => (c.organizationId ?? "") === orgKey);

  // Merge pending pieces per scan into one working queue (FIFO order preserved).
  const byScan = new Map<string, PreparedMapsPriorityRow[]>();
  const metaByScan = new Map<
    string,
    { priority: MapsSubmitPriority; organizationId?: string }
  >();
  const scanOrder: string[] = [];
  for (const chunk of orgTier) {
    if (!byScan.has(chunk.scanKey)) {
      byScan.set(chunk.scanKey, []);
      scanOrder.push(chunk.scanKey);
      metaByScan.set(chunk.scanKey, {
        priority: chunk.priority,
        organizationId: chunk.organizationId,
      });
    }
    byScan.get(chunk.scanKey)!.push(...chunk.rows);
  }

  if (!scanOrder.length) {
    return { selected: [], nextScanIndex: 0, contended: false, takeSize: maxTasks };
  }

  const contended = scanOrder.length > 1;
  const takeSize = mapsPriorityTakeSize(contended);
  // Allow override for tests that pass fairChunkSize while simulating contention.
  const sliceSize = contended
    ? Math.max(1, Math.min(fairChunk, maxTasks))
    : maxTasks;

  let rr = ((opts?.startScanIndex ?? 0) % scanOrder.length + scanOrder.length) % scanOrder.length;
  const selected: FairQueueChunk[] = [];
  let taskCount = 0;
  let idleRounds = 0;

  while (taskCount < maxTasks && idleRounds < scanOrder.length) {
    const scanKey = scanOrder[rr]!;
    const queue = byScan.get(scanKey) ?? [];
    if (!queue.length) {
      idleRounds += 1;
      rr = (rr + 1) % scanOrder.length;
      continue;
    }

    const room = maxTasks - taskCount;
    const n = Math.min(sliceSize, room, queue.length);
    if (n <= 0) {
      idleRounds += 1;
      rr = (rr + 1) % scanOrder.length;
      continue;
    }

    const rows = queue.splice(0, n);
    const meta = metaByScan.get(scanKey)!;
    selected.push({
      scanKey,
      priority: meta.priority,
      organizationId: meta.organizationId,
      rows,
    });
    taskCount += rows.length;
    idleRounds = 0;
    // Solo: keep filling from the same scan. Contended: advance round-robin.
    if (contended) {
      rr = (rr + 1) % scanOrder.length;
    }
  }

  return { selected, nextScanIndex: rr, contended, takeSize };
}

type InternalSubmission = {
  id: string;
  scanKey: string;
  priority: MapsSubmitPriority;
  organizationId?: string;
  remaining: PreparedMapsPriorityRow[];
  posted: PostedMapsPriorityRow[];
  resolve: (posted: PostedMapsPriorityRow[]) => void;
  reject: (err: unknown) => void;
};

/**
 * Process-local adaptive dispatcher.
 */
export class MapsPriorityFairQueue {
  private submissions: InternalSubmission[] = [];
  private draining = false;
  private rrIndex = 0;
  private seq = 0;
  private readonly postOne: PostOneMapsPriorityFn;

  constructor(postOne: PostOneMapsPriorityFn) {
    this.postOne = postOne;
  }

  /** Tests only. */
  resetForTests(): void {
    this.submissions = [];
    this.draining = false;
    this.rrIndex = 0;
  }

  pendingChunkCount(): number {
    return this.submissions.reduce((n, s) => n + (s.remaining.length > 0 ? 1 : 0), 0);
  }

  pendingScanCount(): number {
    return new Set(this.submissions.filter((s) => s.remaining.length > 0).map((s) => s.scanKey))
      .size;
  }

  /**
   * Submit all cells for one scan. Resolves when every cell has been POSTed
   * (not when DataForSEO tasks finish).
   */
  async submitScan(params: {
    scanKey: string;
    priority?: MapsSubmitPriority;
    organizationId?: string;
    rows: PreparedMapsPriorityRow[];
  }): Promise<PostedMapsPriorityRow[]> {
    if (!params.rows.length) return [];
    const scanKey = params.scanKey || `anon-${Date.now()}`;
    const priority = params.priority ?? 2;

    return new Promise<PostedMapsPriorityRow[]>((resolve, reject) => {
      this.submissions.push({
        id: `${scanKey}:${++this.seq}`,
        scanKey,
        priority,
        organizationId: params.organizationId,
        remaining: [...params.rows],
        posted: [],
        resolve,
        reject,
      });
      void this.drain();
    });
  }

  /**
   * Back-compat: accept pre-sliced chunks (flattened into one submission).
   */
  async submitScanChunks(params: {
    scanKey: string;
    priority?: MapsSubmitPriority;
    organizationId?: string;
    chunks: PreparedMapsPriorityRow[][];
  }): Promise<PostedMapsPriorityRow[]> {
    return this.submitScan({
      scanKey: params.scanKey,
      priority: params.priority,
      organizationId: params.organizationId,
      rows: params.chunks.flat(),
    });
  }

  private activeSubmissions(): InternalSubmission[] {
    return this.submissions.filter((s) => s.remaining.length > 0);
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.activeSubmissions().length > 0) {
        // Let a second scan join before filling a solo 100-task POST.
        if (this.pendingScanCount() === 1) {
          const coalesce = dataForSeoMapsCoalesceMs();
          if (coalesce > 0) await sleep(coalesce);
        }

        const active = this.activeSubmissions();
        // Represent each submission as one FairQueueChunk of its remaining rows.
        const pendingView: FairQueueChunk[] = active.map((s) => ({
          scanKey: s.scanKey,
          priority: s.priority,
          organizationId: s.organizationId,
          rows: s.remaining,
        }));

        const { selected, nextScanIndex, contended } = packFairMapsPostPayload(pendingView, {
          startScanIndex: this.rrIndex,
        });
        this.rrIndex = nextScanIndex;

        if (!selected.length) {
          const head = active[0];
          if (head) {
            head.reject(new Error("DataForSEO fair queue could not pack pending cells"));
            this.submissions = this.submissions.filter((s) => s.id !== head.id);
          }
          continue;
        }

        // Consume selected rows from each submission's remaining queue.
        const rows: PreparedMapsPriorityRow[] = [];
        const owners: Array<{ sub: InternalSubmission; count: number }> = [];
        for (const slice of selected) {
          const sub = active.find(
            (s) =>
              s.scanKey === slice.scanKey &&
              s.priority === slice.priority &&
              (s.organizationId ?? "") === (slice.organizationId ?? "") &&
              s.remaining.length > 0
          );
          if (!sub) continue;
          // Prefer matching by exact remaining head tags when possible.
          const take = slice.rows.length;
          const taken = sub.remaining.splice(0, take);
          rows.push(...taken);
          owners.push({ sub, count: taken.length });
        }

        if (!rows.length) continue;

        const organizationId = selected[0]?.organizationId;
        console.log(
          `[DataForSEO] Priority POST pack: ${rows.length} tasks ` +
            `(${contended ? `fair ${dataForSeoMapsAppChunkSize()}-cell RR` : "solo full fill"}, ` +
            `scans=${new Set(selected.map((s) => s.scanKey)).size})`
        );

        try {
          const posted = await this.postOne(rows, organizationId);
          const byTag = new Map(posted.map((p) => [p.tag, p] as const));
          // Attribute posted results back in row order / tag match.
          let cursor = 0;
          for (const { sub, count } of owners) {
            const sliceRows = rows.slice(cursor, cursor + count);
            cursor += count;
            for (const row of sliceRows) {
              const hit = byTag.get(row.tag);
              if (hit) sub.posted.push(hit);
            }
            if (sub.remaining.length === 0) {
              sub.resolve(sub.posted);
              this.submissions = this.submissions.filter((s) => s.id !== sub.id);
            }
          }
        } catch (err) {
          const failed = new Set(owners.map((o) => o.sub.id));
          for (const sub of this.submissions) {
            if (!failed.has(sub.id)) continue;
            sub.reject(err);
          }
          this.submissions = this.submissions.filter((s) => !failed.has(s.id));
        }

        if (this.activeSubmissions().length > 0) {
          await sleep(postDelayMs());
        }
      }
    } finally {
      this.draining = false;
      if (this.activeSubmissions().length > 0) {
        void this.drain();
      }
    }
  }
}

let sharedQueue: MapsPriorityFairQueue | null = null;

export function getMapsPriorityFairQueue(postOne: PostOneMapsPriorityFn): MapsPriorityFairQueue {
  if (!sharedQueue) {
    sharedQueue = new MapsPriorityFairQueue(postOne);
  }
  return sharedQueue;
}

/** Tests only — replace the singleton. */
export function setMapsPriorityFairQueueForTests(queue: MapsPriorityFairQueue | null): void {
  sharedQueue = queue;
}
