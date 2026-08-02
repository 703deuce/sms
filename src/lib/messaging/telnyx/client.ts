/**
 * Minimal Telnyx REST client (Bearer API key).
 * All calls are server-side only.
 * Includes retry/backoff for 429/5xx, optional idempotency, redacted logging.
 */

import { randomUUID } from "crypto";
import { assertTelnyxConfigured, getTelnyxApiBaseUrl } from "./config";

export class TelnyxApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "TelnyxApiError";
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
  idempotencyKey?: string;
  /** Skip automatic retries (default false). */
  noRetry?: boolean;
  /** Max attempts including the first try (default 3). */
  maxAttempts?: number;
};

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 500) return `${value.slice(0, 120)}…[redacted ${value.length} chars]`;
    return value.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, "[phone]");
  }
  if (Array.isArray(value)) return value.slice(0, 20).map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/secret|token|password|authorization|api[_-]?key|ssn|email/i.test(k)) {
        out[k] = "[redacted]";
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return value;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function telnyxRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { apiKey } = assertTelnyxConfigured();
  const base = getTelnyxApiBaseUrl();
  const url = new URL(path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const method = options.method || (options.body !== undefined ? "POST" : "GET");
  const mutating = !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
  const idempotencyKey =
    options.idempotencyKey || (mutating ? `tx-${randomUUID()}` : undefined);

  const maxAttempts = options.noRetry ? 1 : Math.max(1, options.maxAttempts ?? 3);
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const started = Date.now();
    try {
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      if (process.env.TELNYX_HTTP_LOG === "1") {
        console.info(
          "[telnyx]",
          method,
          path,
          res.status,
          `${Date.now() - started}ms`,
          "attempt",
          attempt,
          redact(typeof options.body === "object" ? options.body : undefined),
        );
      }

      if (!res.ok) {
        const msg =
          typeof json === "object" && json && "errors" in json
            ? JSON.stringify((json as { errors: unknown }).errors)
            : `Telnyx API ${res.status}`;
        const err = new TelnyxApiError(msg, res.status, json);
        if (RETRYABLE.has(res.status) && attempt < maxAttempts) {
          const backoff = Math.min(8000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 100);
          await sleep(backoff);
          lastErr = err;
          continue;
        }
        throw err;
      }

      return json as T;
    } catch (err) {
      lastErr = err;
      if (err instanceof TelnyxApiError) throw err;
      if (attempt < maxAttempts) {
        const backoff = Math.min(8000, 250 * 2 ** (attempt - 1));
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("Telnyx request failed");
}
