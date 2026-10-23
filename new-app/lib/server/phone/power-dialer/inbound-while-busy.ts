/** M07 — inbound call handling while rep is on an outbound power-dialer session. */

export type InboundWhileBusyBehavior =
  | "route_to_voicemail"
  | "route_to_ai_receptionist"
  | "queue_for_rep"
  | "reject_with_busy";

export type InboundWhileBusyConfig = {
  behavior: InboundWhileBusyBehavior;
  notifyRep: boolean;
};

export function parseInboundWhileBusyConfig(raw: unknown): InboundWhileBusyConfig {
  const defaults: InboundWhileBusyConfig = {
    behavior: "route_to_voicemail",
    notifyRep: true,
  };
  if (!raw || typeof raw !== "object") return defaults;
  const o = (raw as { inboundWhileBusy?: unknown }).inboundWhileBusy;
  if (!o || typeof o !== "object") return defaults;
  const b = o as Record<string, unknown>;
  const behavior = b.behavior;
  const allowed: InboundWhileBusyBehavior[] = [
    "route_to_voicemail",
    "route_to_ai_receptionist",
    "queue_for_rep",
    "reject_with_busy",
  ];
  return {
    behavior: allowed.includes(behavior as InboundWhileBusyBehavior)
      ? (behavior as InboundWhileBusyBehavior)
      : defaults.behavior,
    notifyRep: b.notifyRep !== false,
  };
}

export function inboundBusyUserMessage(config: InboundWhileBusyConfig): string {
  switch (config.behavior) {
    case "route_to_ai_receptionist":
      return "Inbound calls while you are on a dialer call are sent to your AI receptionist.";
    case "queue_for_rep":
      return "Inbound calls are queued until you finish your current dialer call.";
    case "reject_with_busy":
      return "Inbound calls receive a busy signal while you are on a dialer call.";
    default:
      return "Inbound calls go to voicemail while you are on a dialer call.";
  }
}
