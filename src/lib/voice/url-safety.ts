import { lookup } from "node:dns/promises";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
]);

function isPrivateIp(host: string): boolean {
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (host.startsWith("169.254.")) return true;
  if (host === "127.0.0.1" || host.startsWith("127.")) return true;
  return false;
}

/** SSRF guard for webhook/API tools — blocks private networks and non-http(s). */
export async function assertSafeWebhookUrl(raw: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid webhook URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Webhook URL must use http or https");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("Production webhook URLs must use https");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local")) {
    throw new Error("Webhook URL host is not allowed");
  }
  if (isPrivateIp(host)) {
    throw new Error("Webhook URL must not target a private network");
  }
  const resolved = await lookup(host, { all: true });
  for (const addr of resolved) {
    if (isPrivateIp(addr.address)) {
      throw new Error("Webhook URL resolves to a private IP");
    }
  }
  return url.toString();
}
