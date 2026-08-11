export class IntegrationHttpError extends Error {
  status: number;
  body: unknown;
  retryable: boolean;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
    this.retryable = status === 429 || status >= 500;
  }
}

export async function integrationFetch<T = unknown>(
  url: string,
  init: RequestInit & {
    accessToken?: string;
    basicAuth?: { username: string; password: string };
    apiKeyHeader?: { name: string; value: string };
    /** Abort the request after this many milliseconds (default: no timeout). */
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.accessToken) headers.set("Authorization", `Bearer ${init.accessToken}`);
  if (init.basicAuth) {
    const token = Buffer.from(
      `${init.basicAuth.username}:${init.basicAuth.password}`,
      "utf8",
    ).toString("base64");
    headers.set("Authorization", `Basic ${token}`);
  }
  if (init.apiKeyHeader) headers.set(init.apiKeyHeader.name, init.apiKeyHeader.value);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const { timeoutMs, ...fetchInit } = init;
  const controller = new AbortController();
  const timer =
    timeoutMs && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  let res: Response;
  try {
    res = await fetch(url, { ...fetchInit, headers, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new IntegrationHttpError(
        `Integration HTTP timeout after ${timeoutMs}ms`,
        408,
      );
    }
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg =
      typeof json === "object" && json && ("message" in json || "detail" in json || "title" in json)
        ? String(
            (json as { message?: unknown; detail?: unknown; title?: unknown }).message ||
              (json as { detail?: unknown }).detail ||
              (json as { title?: unknown }).title,
          )
        : `Integration HTTP ${res.status}`;
    throw new IntegrationHttpError(msg, res.status, json);
  }
  if (json == null) return {} as T;
  return json as T;
}

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function withRetries<T>(
  fn: () => Promise<T>,
  opts?: { attempts?: number; baseMs?: number },
): Promise<T> {
  const attempts = opts?.attempts ?? 3;
  const baseMs = opts?.baseMs ?? 400;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable =
        err instanceof IntegrationHttpError ? err.retryable : i < attempts - 1;
      if (!retryable || i === attempts - 1) throw err;
      await sleep(baseMs * Math.pow(2, i));
    }
  }
  throw lastErr;
}
