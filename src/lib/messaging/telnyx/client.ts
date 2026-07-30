/**
 * Minimal Telnyx REST client (Bearer API key).
 * All calls are server-side only.
 */

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
};

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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const res = await fetch(url.toString(), {
    method: options.method || (options.body !== undefined ? "POST" : "GET"),
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

  if (!res.ok) {
    const msg =
      typeof json === "object" && json && "errors" in json
        ? JSON.stringify((json as { errors: unknown }).errors)
        : `Telnyx API ${res.status}`;
    throw new TelnyxApiError(msg, res.status, json);
  }

  return json as T;
}
