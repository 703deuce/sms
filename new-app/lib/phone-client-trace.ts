import { phoneClientLog } from "@/lib/phone-client-log";

export function phoneClientTrace(
  event: string,
  fields?: Record<string, unknown>,
) {
  phoneClientLog("trace", event, fields);
  if (typeof fetch === "undefined") return;
  const payload = {
    event,
    ...fields,
    clientAt: Date.now(),
  };
  void fetch("/api/phone/webrtc/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}
