export class CrmHttpError extends Error {
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

export async function crmFetch<T = unknown>(
  url: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (init.accessToken) headers.set("Authorization", `Bearer ${init.accessToken}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const msg =
      typeof json === "object" && json && "message" in json
        ? String((json as { message: unknown }).message)
        : `CRM HTTP ${res.status}`;
    throw new CrmHttpError(msg, res.status, json);
  }
  return json as T;
}
