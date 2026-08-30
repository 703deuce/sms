import { KIMI_PROGRESS_HEARTBEAT_MS } from "./config";
import { appendProgressLog } from "./progress";

export async function kimiFetch(
  url: string,
  init: RequestInit & {
    timeoutMs: number;
    label: string;
    sessionId?: string;
  },
): Promise<Response> {
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
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return res;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const minutes = Math.round(init.timeoutMs / 60000);
      throw new Error(`${init.label} timed out after ${minutes} minutes. The model may still be working — retry or increase KIMI_CHAT_TIMEOUT_MS.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    clearInterval(heartbeat);
  }
}
