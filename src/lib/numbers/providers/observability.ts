import type { NumberUpstreamProvider, ProviderOperationLog } from "./types";

export function logProviderOperation(entry: ProviderOperationLog) {
  console.info(
    JSON.stringify({
      scope: "number_provider",
      provider: entry.provider,
      operation: entry.operation,
      number: entry.number,
      provider_request_id: entry.providerRequestId,
      latency_ms: entry.latencyMs,
      success: entry.success,
      error_code: entry.errorCode,
    }),
  );
}

export async function withProviderTiming<T>(
  provider: NumberUpstreamProvider,
  operation: string,
  fn: () => Promise<T>,
  number?: string,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logProviderOperation({
      provider,
      operation,
      number,
      latencyMs: Date.now() - start,
      success: true,
    });
    return result;
  } catch (err) {
    logProviderOperation({
      provider,
      operation,
      number,
      latencyMs: Date.now() - start,
      success: false,
      errorCode: err instanceof Error ? err.message.slice(0, 120) : "unknown",
    });
    throw err;
  }
}
