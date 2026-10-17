"use client";

const PREFIX = "[visualizer:client]";

/** Console logging for Visualizer UI → API flows (always on so mobile Safari debugging is possible). */
export function vizClientLog(step: string, data?: Record<string, unknown>) {
  if (data && Object.keys(data).length > 0) {
    console.log(PREFIX, step, data);
  } else {
    console.log(PREFIX, step);
  }
}

export function vizClientError(step: string, err: unknown, data?: Record<string, unknown>) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(PREFIX, step, { message, ...data, stack: err instanceof Error ? err.stack : undefined });
}

function parseBody<T>(label: string, response: Response, text: string): T {
  if (!text.trim()) {
    if (response.ok) return {} as T;
    throw new Error(`(${label}) Empty response (${response.status} ${response.statusText})`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    vizClientError(`${label}:json-parse`, new Error("JSON.parse failed"), {
      status: response.status,
      bodyPreview: text.slice(0, 400),
    });
    throw new Error(
      `(${label}) Server returned non-JSON (${response.status}): ${text.slice(0, 200).replace(/\s+/g, " ")}`,
    );
  }
}

export async function vizFetchJson<T extends { error?: string }>(
  label: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method ?? "GET";
  vizClientLog(`${label} → request`, { method, url });

  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (networkErr) {
    vizClientError(`${label}:network`, networkErr, { method, url });
    throw new Error(`(${label}) Network error: ${networkErr instanceof Error ? networkErr.message : "failed"}`);
  }

  const text = await response.text();
  vizClientLog(`${label} ← response`, {
    status: response.status,
    statusText: response.statusText,
    bodyLength: text.length,
    bodyPreview: text.slice(0, 300),
  });

  const data = parseBody<T>(label, response, text);
  if (!response.ok) {
    const msg =
      (typeof data.error === "string" && data.error.trim()) ||
      `(${label}) Request failed (${response.status} ${response.statusText})`;
    vizClientError(`${label}:http`, new Error(msg), { status: response.status });
    throw new Error(msg);
  }

  vizClientLog(`${label} ← ok`);
  return data;
}

export async function vizUploadForm<T extends { error?: string }>(
  label: string,
  url: string,
  formData: FormData,
  meta?: Record<string, unknown>,
): Promise<T> {
  const file = formData.get("file");
  const fileMeta =
    file instanceof File
      ? { name: file.name, size: file.size, type: file.type || "(empty)" }
      : { file: file === null ? "missing" : typeof file };
  vizClientLog(`${label} → upload`, { url, ...meta, ...fileMeta });

  return vizFetchJson<T>(label, url, { method: "POST", body: formData });
}
