/**
 * DataForSEO Google Maps Priority (queued) batch client.
 *
 * Submit via the fair queue (25-cell app chunks → ≤100-task POSTs, 50–100ms
 * pacing, round-robin across concurrent scans), then poll task_get until ready.
 * Never waits for task completion before the next POST.
 */

import {
  buildMapsLiveRequest,
  mapsLiveRequestBody,
} from "@/lib/providers/dataforseo/build-maps-request";
import {
  dataForSeoGet,
  dataForSeoRequest,
  isDataForSeoQueueStatus,
} from "@/lib/providers/dataforseo/client";
import type { MapsLiveResult, MapsLiveResponse } from "@/lib/providers/dataforseo/index";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { minCellSerpResults } from "@/lib/maps/cell-result-integrity";
import {
  dataForSeoMapsAppChunkSize,
  dataForSeoMapsMaxTasksPerPost,
  dataForSeoMapsPollGetConcurrency,
} from "@/lib/providers/maps-grid/config";
import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";
import {
  getMapsPriorityFairQueue,
  mapsSubmitPriorityFromJob,
  type MapsPriorityRequest,
  type MapsSubmitPriority,
  type PreparedMapsPriorityRow,
  type PostedMapsPriorityRow,
} from "@/lib/providers/dataforseo/maps-priority-fair-queue";

/** DataForSEO tags: keep alphanumeric + hyphen/underscore (no raw UUID colons). */
export function sanitizeMapsTaskTag(tag: string): string {
  return tag.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 255);
}

/** Keep organic/paid Maps listings; drop refinement chips and other noise. */
export function normalizeMapsSerpItems(items: MapsLiveResult[] | null | undefined): MapsLiveResult[] {
  if (!items?.length) return [];
  const filtered = items.filter((item) => {
    const t = item.type;
    return !t || t === "maps_search" || t === "maps_paid_item";
  });
  return filtered.length ? filtered : items;
}

export const MAPS_TASK_POST_ENDPOINT = "serp/google/maps/task_post";
export const MAPS_TASK_GET_ADVANCED_PREFIX = "serp/google/maps/task_get/advanced";

/** High priority — ~1 minute average per DataForSEO docs. */
export const DATAFORSEO_MAPS_PRIORITY_HIGH = 2;
/** Standard (normal) queue priority. */
export const DATAFORSEO_MAPS_PRIORITY_STANDARD = 1;

export type MapsPriorityCellInput = {
  /** Stable id used as DataForSEO `tag` and result key. */
  tag: string;
  keyword: string;
  lat: number;
  lng: number;
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  depth: number;
  languageCode?: string;
  zoom?: number;
  searchThisArea?: boolean;
  /** DataForSEO task_post priority (1=standard, 2=high). Defaults to 2. */
  dfsApiPriority?: 1 | 2;
};

export type MapsPriorityCellResult = {
  tag: string;
  taskId: string | null;
  ok: boolean;
  items: MapsLiveResult[];
  checkUrl?: string;
  timestamp?: string;
  request: MapsPriorityRequest;
  taskStatus?: number | null;
  taskMessage?: string | null;
  errorMessage?: string;
};

function buildPriorityTaskBody(cell: MapsPriorityCellInput) {
  const profile = {
    device: cell.device,
    os: cell.os,
    browser: cell.browser,
  };
  const dfsPriority =
    cell.dfsApiPriority === 1
      ? DATAFORSEO_MAPS_PRIORITY_STANDARD
      : DATAFORSEO_MAPS_PRIORITY_HIGH;
  const request = buildMapsLiveRequest({
    keyword: cell.keyword,
    lat: cell.lat,
    lng: cell.lng,
    profile,
    depth: cell.depth,
    languageCode: cell.languageCode ?? LOCAL_FALCON_PARITY.languageCode,
    zoom: cell.zoom ?? LOCAL_FALCON_PARITY.locationZoom,
    searchThisArea: cell.searchThisArea ?? LOCAL_FALCON_PARITY.searchThisArea,
    searchPlaces: LOCAL_FALCON_PARITY.searchPlaces,
    seDomain: LOCAL_FALCON_PARITY.seDomain,
  });
  const body = {
    ...mapsLiveRequestBody(request),
    priority: dfsPriority,
    tag: sanitizeMapsTaskTag(cell.tag),
  };
  return {
    body,
    request: { ...request, priority: dfsPriority as number },
  };
}

export type PostedMapsPriorityTask = PostedMapsPriorityRow;

/**
 * One DataForSEO task_post (≤100 tasks). Does not wait for task completion.
 */
export async function postOneMapsPriorityRequest(
  rows: PreparedMapsPriorityRow[],
  organizationId?: string
): Promise<PostedMapsPriorityRow[]> {
  if (!rows.length) return [];
  if (rows.length > dataForSeoMapsMaxTasksPerPost()) {
    throw new Error(
      `DataForSEO task_post supports at most ${dataForSeoMapsMaxTasksPerPost()} tasks (got ${rows.length})`
    );
  }

  const data = await dataForSeoRequest<{
    tasks?: Array<{
      id?: string;
      status_code?: number;
      status_message?: string;
      data?: { tag?: string };
    }>;
  }>(
    MAPS_TASK_POST_ENDPOINT,
    rows.map((c) => c.body),
    organizationId
  );

  const posted: PostedMapsPriorityRow[] = [];
  const byTag = new Map(rows.map((c) => [c.tag, c] as const));
  const claimed = new Set<string>();

  for (const task of data.tasks ?? []) {
    const tag = sanitizeMapsTaskTag(String(task.data?.tag ?? ""));
    const preparedRow = byTag.get(tag);
    if (!task.id || !preparedRow || claimed.has(tag)) continue;
    claimed.add(tag);
    posted.push({
      tag: preparedRow.tag,
      taskId: task.id,
      request: preparedRow.request,
    });
  }

  // Index zip for rows whose tags were not echoed.
  if (posted.length < rows.length) {
    rows.forEach((row, idx) => {
      if (claimed.has(row.tag)) return;
      const taskId = data.tasks?.[idx]?.id;
      if (!taskId) return;
      claimed.add(row.tag);
      posted.push({ tag: row.tag, taskId, request: row.request });
    });
  }

  return posted;
}

/**
 * Adaptive fair submit: solo scans fill POSTs to 100; when other maps are
 * waiting, 25-cell slices round-robin. Pace 50–100ms between POSTs.
 */
export async function postMapsPriorityTasks(
  cells: MapsPriorityCellInput[],
  organizationId?: string,
  options?: {
    scanKey?: string;
    submitPriority?: MapsSubmitPriority | string | number | null;
  }
): Promise<PostedMapsPriorityTask[]> {
  if (!cells.length) return [];

  const prepared: PreparedMapsPriorityRow[] = cells.map((cell) => {
    const { body, request } = buildPriorityTaskBody(cell);
    const tag = sanitizeMapsTaskTag(cell.tag);
    return { tag, body: { ...body, tag }, request };
  });

  const queue = getMapsPriorityFairQueue(postOneMapsPriorityRequest);
  const scanKey =
    options?.scanKey ?? `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const priority = mapsSubmitPriorityFromJob(options?.submitPriority);

  console.log(
    `[DataForSEO] Adaptive Priority submit: ${cells.length} tasks ` +
      `(solo→${dataForSeoMapsMaxTasksPerPost()}/POST, contended→${dataForSeoMapsAppChunkSize()}-cell RR, ` +
      `scan=${scanKey}, appPriority=${priority})`
  );

  const posted = await queue.submitScan({
    scanKey,
    priority,
    organizationId,
    rows: prepared,
  });

  if (posted.length !== cells.length) {
    console.warn(
      `[DataForSEO] Priority post mapped ${posted.length}/${cells.length} tasks (some tags missing)`
    );
  }

  return posted;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function dataForSeoPriorityPollIntervalMs(): number {
  const n = Number(process.env.DATAFORSEO_MAPS_PRIORITY_POLL_MS ?? 4000);
  return Number.isFinite(n) && n >= 500 ? Math.min(n, 30_000) : 4000;
}

export function dataForSeoPriorityPollTimeoutMs(): number {
  const n = Number(process.env.DATAFORSEO_MAPS_PRIORITY_POLL_TIMEOUT_MS ?? 180_000);
  return Number.isFinite(n) && n >= 15_000 ? Math.min(n, 600_000) : 180_000;
}

type PolledTask = {
  taskId: string;
  statusCode: number | null;
  statusMessage: string | null;
  items: MapsLiveResult[];
  checkUrl?: string;
  timestamp?: string;
  done: boolean;
  failed: boolean;
};

async function getMapsTaskAdvanced(
  taskId: string,
  organizationId?: string
): Promise<PolledTask> {
  const data = await dataForSeoGet<MapsLiveResponse>(
    `${MAPS_TASK_GET_ADVANCED_PREFIX}/${taskId}`,
    organizationId,
    { quietQueue: true }
  );
  const task = data.tasks?.[0];
  const statusCode = task?.status_code ?? null;
  const statusMessage = task?.status_message ?? null;
  const result = task?.result?.[0] as
    | {
        items?: MapsLiveResult[];
        items_count?: number;
        check_url?: string;
        datetime?: string;
      }
    | undefined;
  const items = normalizeMapsSerpItems(result?.items);

  const queued = isDataForSeoQueueStatus(statusCode);
  const hardFail = statusCode != null && statusCode >= 40000 && !queued;
  const ready = statusCode === 20000;

  return {
    taskId,
    statusCode,
    statusMessage,
    items,
    checkUrl: result?.check_url,
    timestamp: result?.datetime,
    done: ready || hardFail,
    failed: hardFail,
  };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  if (!items.length) return [];
  const limit = Math.max(1, concurrency);
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

/**
 * Poll all task IDs until each is ready/failed or the timeout elapses.
 * GETs are capped per tick so large grids do not stampede task_get.
 */
export async function pollMapsPriorityTasks(
  taskIds: string[],
  organizationId?: string,
  options?: { pollIntervalMs?: number; timeoutMs?: number; getConcurrency?: number }
): Promise<Map<string, PolledTask>> {
  const pending = new Set(taskIds.filter(Boolean));
  const finished = new Map<string, PolledTask>();
  if (!pending.size) return finished;

  const intervalMs = options?.pollIntervalMs ?? dataForSeoPriorityPollIntervalMs();
  const timeoutMs = options?.timeoutMs ?? dataForSeoPriorityPollTimeoutMs();
  const getConcurrency = options?.getConcurrency ?? dataForSeoMapsPollGetConcurrency();
  const deadline = Date.now() + timeoutMs;

  while (pending.size > 0 && Date.now() < deadline) {
    const ids = [...pending];
    const results = await mapPool(ids, getConcurrency, (id) =>
      getMapsTaskAdvanced(id, organizationId).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        return {
          taskId: id,
          statusCode: null,
          statusMessage: message,
          items: [] as MapsLiveResult[],
          done: false,
          failed: false,
        } satisfies PolledTask;
      })
    );

    for (const row of results) {
      if (!row.done) continue;
      finished.set(row.taskId, row);
      pending.delete(row.taskId);
    }

    if (pending.size === 0) break;
    await sleep(intervalMs);
  }

  for (const id of pending) {
    finished.set(id, {
      taskId: id,
      statusCode: null,
      statusMessage: "Priority task poll timed out",
      items: [],
      done: true,
      failed: true,
    });
  }

  return finished;
}

/**
 * Submit all cells via fair Priority queue, then retrieve finished tasks.
 * Does not enforce items>=depth — callers validate.
 */
export async function runMapsPriorityBatch(
  cells: MapsPriorityCellInput[],
  organizationId?: string,
  options?: {
    pollIntervalMs?: number;
    timeoutMs?: number;
    scanKey?: string;
    submitPriority?: MapsSubmitPriority | string | number | null;
  }
): Promise<MapsPriorityCellResult[]> {
  if (!cells.length) return [];

  const byTag = new Map(
    cells.map((c) => [sanitizeMapsTaskTag(c.tag), c] as const)
  );
  const samplePriority = cells[0]?.dfsApiPriority === 1 ? 1 : 2;
  console.log(
    `[DataForSEO] Priority batch submit: ${cells.length} tasks (appChunk=${dataForSeoMapsAppChunkSize()}, max ${dataForSeoMapsMaxTasksPerPost()}/POST, dfsPriority=${samplePriority}, search_this_area=${LOCAL_FALCON_PARITY.searchThisArea}, search_places=${LOCAL_FALCON_PARITY.searchPlaces})`
  );

  const posted = await postMapsPriorityTasks(cells, organizationId, {
    scanKey: options?.scanKey,
    submitPriority: options?.submitPriority,
  });
  const postedByTag = new Map(posted.map((p) => [p.tag, p] as const));

  const polled = await pollMapsPriorityTasks(
    posted.map((p) => p.taskId),
    organizationId,
    options
  );

  const results: MapsPriorityCellResult[] = [];
  for (const cell of cells) {
    const tag = sanitizeMapsTaskTag(cell.tag);
    const post = postedByTag.get(tag);
    const { request } = buildPriorityTaskBody(cell);

    if (!post) {
      results.push({
        tag,
        taskId: null,
        ok: false,
        items: [],
        request,
        errorMessage: "DataForSEO Priority task_post did not return a task id",
      });
      continue;
    }

    const got = polled.get(post.taskId);
    if (!got) {
      results.push({
        tag,
        taskId: post.taskId,
        ok: false,
        items: [],
        request: post.request,
        errorMessage: "DataForSEO Priority task result missing after poll",
      });
      continue;
    }

    if (got.failed && !got.items.length) {
      results.push({
        tag,
        taskId: post.taskId,
        ok: false,
        items: [],
        request: post.request,
        taskStatus: got.statusCode,
        taskMessage: got.statusMessage,
        errorMessage: got.statusMessage ?? "DataForSEO Priority task failed",
      });
      continue;
    }

    results.push({
      tag,
      taskId: post.taskId,
      ok: got.statusCode === 20000,
      items: got.items,
      checkUrl: got.checkUrl,
      timestamp: got.timestamp,
      request: post.request,
      taskStatus: got.statusCode,
      taskMessage: got.statusMessage,
    });
  }

  const withItems = results.filter((r) => r.items.length > 0).length;
  const fullEnough = results.filter(
    (r) => r.items.length >= minCellSerpResults(byTag.get(r.tag)?.depth ?? 20)
  ).length;
  console.log(
    `[DataForSEO] Priority batch done: ${results.length} cells, ${withItems} with items, ${fullEnough} meeting min SERP`
  );

  return results;
}

/**
 * Single-cell Priority helper (post one + poll). Used by adapters / keyword tracker.
 */
export async function mapsPriorityGridCell(params: {
  keyword: string;
  lat: number;
  lng: number;
  languageCode?: string;
  device?: string;
  os?: string;
  browser?: string;
  depth?: number;
  zoom?: number;
  organizationId?: string;
  tag?: string;
}): Promise<{
  items: MapsLiveResult[];
  checkUrl?: string;
  timestamp?: string;
  request: MapsPriorityCellResult["request"];
}> {
  const tag = params.tag ?? `cell-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const depth = params.depth ?? LOCAL_FALCON_PARITY.gridDepth;
  const [result] = await runMapsPriorityBatch(
    [
      {
        tag,
        keyword: params.keyword,
        lat: params.lat,
        lng: params.lng,
        device: (params.device === "desktop" ? "desktop" : "mobile") as "mobile" | "desktop",
        os: (params.os ?? "android") as ScanDeviceProfile["os"],
        browser: (params.browser === "firefox" ? "firefox" : "chrome") as "chrome" | "firefox",
        depth,
        languageCode: params.languageCode,
        zoom: params.zoom,
        searchThisArea: LOCAL_FALCON_PARITY.searchThisArea,
      },
    ],
    params.organizationId,
    { scanKey: `single-${tag}`, submitPriority: 2 }
  );

  if (!result) {
    throw new Error("DataForSEO Priority returned no result for this cell");
  }
  if (!result.ok && !result.items.length) {
    throw new Error(result.errorMessage ?? "DataForSEO Priority task failed");
  }
  if (!result.items.length) {
    throw new Error("DataForSEO returned no map results for this cell");
  }
  if (result.items.length < minCellSerpResults(depth)) {
    throw new Error(
      `sparse SERP: ${result.items.length} results returned (need ${minCellSerpResults(depth)})`
    );
  }

  return {
    items: result.items,
    checkUrl: result.checkUrl,
    timestamp: result.timestamp,
    request: result.request,
  };
}
