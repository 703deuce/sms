import { Agent, fetch as undiciFetch } from "undici";
import { KIMI_PROGRESS_HEARTBEAT_MS } from "./config";
import { appendProgressLog } from "./progress";

const kimiHttpAgent = new Agent({
  /** Kimi may not send response headers for several minutes while analyzing video. */
  headersTimeout: 0,
  bodyTimeout: 0,
  connectTimeout: 60_000,
  keepAliveTimeout: 60_000,
  keepAliveMaxTimeout: 3_600_000,
});

function isRetryableFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError") return false;
  const message = `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("socket hang up") ||
    message.includes("network") ||
    message.includes("headers timeout")
  );
}

function formatFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? ` (${error.cause.name}: ${error.cause.message})` : "";
  return `${error.message}${cause}`;
}

export async function kimiFetch(
  url: string,
  init: RequestInit & {
    timeoutMs: number;
    label: string;
    sessionId?: string;
    maxRetries?: number;
  },
): Promise<Response> {
  const maxRetries = init.maxRetries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const started = Date.now();
    const timeout = setTimeout(() => controller.abort(), init.timeoutMs);

    const heartbeat = setInterval(() => {
      const elapsedSec = Math.round((Date.now() - started) / 1000);
      const line = `${init.label} still running… ${elapsedSec}s elapsed`;
      if (init.sessionId) appendProgressLog(init.sessionId, line);
      else console.log(`[ui-agent] ${line}`);
    }, KIMI_PROGRESS_HEARTBEAT_MS);

    try {
      const res = await undiciFetch(url, {
        ...init,
        signal: controller.signal,
        dispatcher: kimiHttpAgent,
      });
      return res as unknown as Response;
    } catch (error) {
      lastError = error;
      if (error instanceof Error && error.name === "AbortError") {
        const minutes = Math.round(init.timeoutMs / 60000);
        throw new Error(
          `${init.label} timed out after ${minutes} minutes. The model may still be working — retry or increase KIMI_CHAT_TIMEOUT_MS.`,
        );
      }

      const canRetry = attempt < maxRetries && isRetryableFetchError(error);
      const detail = formatFetchError(error);
      if (canRetry) {
        const waitSec = 5 * (attempt + 1);
        const line = `${init.label} failed (${detail}); retrying in ${waitSec}s (attempt ${attempt + 1}/${maxRetries})…`;
        if (init.sessionId) appendProgressLog(init.sessionId, line);
        else console.warn(`[ui-agent] ${line}`);
        await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
        continue;
      }

      throw error instanceof Error ? new Error(detail) : error;
    } finally {
      clearTimeout(timeout);
      clearInterval(heartbeat);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
