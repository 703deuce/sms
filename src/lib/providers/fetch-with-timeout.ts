export function providerTimeoutMs(kind: "default" | "sms" | "voice" = "default"): number {
  if (kind === "sms") return 25_000;
  if (kind === "voice") return 60_000;
  return 30_000;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? providerTimeoutMs("default");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { timeoutMs: _drop, ...rest } = init ?? {};
    return await fetch(input, { ...rest, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
