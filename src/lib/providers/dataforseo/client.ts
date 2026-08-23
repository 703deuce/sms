import { createServiceClient } from "@/lib/db/client";
import { hashRequest } from "@/lib/utils";
import {
  estimateProviderCost,
  fetchWithTimeout,
  providerTimeoutMs,
} from "@/lib/providers/fetch-with-timeout";

export interface ProviderRunLog {
  organizationId?: string;
  provider: string;
  endpoint: string;
  request: unknown;
  response: unknown;
  statusCode: number;
  latencyMs: number;
  costEstimate?: number;
  externalTaskId?: string;
}

export async function logProviderRun(log: ProviderRunLog): Promise<void> {
  let requestHash = "";
  try {
    const supabase = createServiceClient();
    requestHash = await hashRequest(log.request);
    await supabase.from("provider_runs").insert({
      organization_id: log.organizationId ?? null,
      provider: log.provider,
      endpoint: log.endpoint,
      request_hash: requestHash,
      external_task_id: log.externalTaskId ?? null,
      status_code: log.statusCode,
      latency_ms: log.latencyMs,
      cost_estimate: log.costEstimate ?? null,
      raw_request_json: log.request as Record<string, unknown>,
      raw_response_json: log.response as Record<string, unknown>,
    });
  } catch {
    // Non-blocking audit log
  }

  if (
    log.organizationId &&
    log.statusCode >= 200 &&
    log.statusCode < 300 &&
    !["nominatim", "twilio", "brevo"].includes(log.provider)
  ) {
    try {
      const { trackProviderUsage } = await import("@/lib/providers/gateway");
      const cost =
        log.costEstimate ??
        (await import("@/lib/providers/fetch-with-timeout")).estimateProviderCost(log.provider);
      await trackProviderUsage(log.provider, {
        organizationId: log.organizationId,
        feature: `${log.provider}:${log.endpoint}`,
        unitType: "request",
        estimatedCostUsd: cost,
        actualCostUsd: cost,
        actualUnits: 1,
        idempotencyKey: `${log.provider}:${log.endpoint}:${log.organizationId}:${requestHash || log.latencyMs}`,
      });
    } catch {
      // Non-blocking ledger
    }
  }
}

function getCredentials(): { username: string; password: string } {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!username || !password) {
    throw new Error("DATAFORSEO_USERNAME and DATAFORSEO_PASSWORD are required");
  }
  return { username, password };
}

function authHeader(): string {
  const { username, password } = getCredentials();
  return "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
}

function summarizeDataForSeoResponse(
  endpoint: string,
  httpStatus: number,
  data: unknown,
  latencyMs: number
) {
  const payload = data as {
    tasks?: Array<{
      id?: string;
      status_code?: number;
      status_message?: string;
      result?: Array<{ items?: unknown[]; keyword?: string }>;
    }>;
  };
  const task = payload.tasks?.[0];
  const firstResult = task?.result?.[0];
  return {
    endpoint,
    httpStatus,
    latencyMs,
    taskId: task?.id ?? null,
    taskStatus: task?.status_code ?? null,
    taskMessage: task?.status_message ?? null,
    resultCount: task?.result?.length ?? 0,
    itemCount: firstResult?.items?.length ?? 0,
    keyword: firstResult?.keyword ?? null,
  };
}

const DATAFORSEO_QUEUE_STATUSES = new Set([40601, 40602]);

export function isDataForSeoQueueStatus(status: number | null | undefined): boolean {
  return status != null && DATAFORSEO_QUEUE_STATUSES.has(status);
}

function logDataForSeoResponse(
  endpoint: string,
  httpStatus: number,
  data: unknown,
  latencyMs: number,
  options?: { quietQueue?: boolean }
): void {
  const summary = summarizeDataForSeoResponse(endpoint, httpStatus, data, latencyMs);
  const isQueue = isDataForSeoQueueStatus(summary.taskStatus);
  const isTaskError =
    summary.taskStatus != null && summary.taskStatus >= 40000 && !isQueue;
  const isHttpError = httpStatus >= 400;
  const isEmptyMaps =
    endpoint.includes("maps") && summary.taskStatus === 20000 && summary.itemCount === 0;
  const isSparseMaps =
    endpoint.includes("maps") &&
    summary.taskStatus === 20000 &&
    summary.itemCount > 0 &&
    summary.itemCount < 10;

  if (isQueue) {
    if (!options?.quietQueue) {
      console.log("[DataForSEO] Task queued:", summary);
    }
    return;
  }

  if (isHttpError || isTaskError) {
    console.error("[DataForSEO] Request failed:", summary);
    console.error("[DataForSEO] Full response:", JSON.stringify(data, null, 2));
    return;
  }

  if (isEmptyMaps) {
    console.warn("[DataForSEO] Request OK but returned 0 map items:", summary);
    console.warn("[DataForSEO] Full response:", JSON.stringify(data, null, 2));
    return;
  }

  if (isSparseMaps) {
    console.warn(
      "[DataForSEO] Request OK but incomplete Maps pack (<10 items):",
      summary
    );
    return;
  }

  console.log("[DataForSEO] Request OK:", summary);
}

export async function dataForSeoRequest<T>(
  endpoint: string,
  body: unknown,
  organizationId?: string
): Promise<T> {
  const start = Date.now();
  const url = `https://api.dataforseo.com/v3/${endpoint}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(Array.isArray(body) ? body : [body]),
    },
    {
      provider: "dataforseo",
      timeoutMs: providerTimeoutMs("dataforseo", 90_000),
      label: endpoint,
    }
  );
  const latencyMs = Date.now() - start;
  const data = await res.json();
  logDataForSeoResponse(endpoint, res.status, data, latencyMs);
  await logProviderRun({
    organizationId,
    provider: "dataforseo",
    endpoint,
    request: body,
    response: data,
    statusCode: res.status,
    latencyMs,
    costEstimate: estimateProviderCost("dataforseo"),
  });
  if (!res.ok) {
    const msg = `DataForSEO HTTP ${res.status}: ${JSON.stringify(data)}`;
    console.error("[DataForSEO] Throwing:", msg);
    throw new Error(msg);
  }

  const task = (data as { tasks?: Array<{ status_code?: number; status_message?: string }> })
    ?.tasks?.[0];
  if (
    task?.status_code &&
    task.status_code >= 40000 &&
    !isDataForSeoQueueStatus(task.status_code)
  ) {
    const msg = task.status_message ?? `DataForSEO task error ${task.status_code}`;
    console.error(`[DataForSEO] Throwing task error ${task.status_code}:`, msg);
    throw new Error(msg);
  }

  return data as T;
}

export async function dataForSeoGet<T>(
  endpoint: string,
  organizationId?: string,
  options?: { quietQueue?: boolean }
): Promise<T> {
  const start = Date.now();
  const url = `https://api.dataforseo.com/v3/${endpoint}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: { Authorization: authHeader() },
    },
    {
      provider: "dataforseo",
      timeoutMs: providerTimeoutMs("dataforseo", 90_000),
      label: endpoint,
    }
  );
  const latencyMs = Date.now() - start;
  const data = await res.json();
  logDataForSeoResponse(endpoint, res.status, data, latencyMs, options);
  await logProviderRun({
    organizationId,
    provider: "dataforseo",
    endpoint,
    request: {},
    response: data,
    statusCode: res.status,
    latencyMs,
    costEstimate: estimateProviderCost("dataforseo"),
  });
  if (!res.ok) throw new Error(`DataForSEO HTTP ${res.status}`);
  return data as T;
}
