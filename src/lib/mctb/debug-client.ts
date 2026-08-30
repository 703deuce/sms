"use client";

type MctbClientDebugArea =
  | "setup"
  | "schedule"
  | "missed-calls"
  | "missed-call-detail"
  | "consent-log"
  | "consent-prompt"
  | "analytics"
  | "dashboard"
  | "try-it"
  | "onboarding"
  | "reports";

/** Fire-and-forget client action log → dev server terminal via /api/mctb/debug/log */
export function traceMctbClient(
  area: MctbClientDebugArea,
  event: string,
  fields?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  const payload = { area, event, at: new Date().toISOString(), ...fields };
  console.log(`[mctb-debug-client] ${area}:${event}`, payload);
  void fetch("/api/mctb/debug/log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => undefined);
}
