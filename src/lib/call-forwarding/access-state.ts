export type CallForwardingOutboundState = {
  kind: "call_forwarding_outbound";
  outboundCallId: string;
  workspaceId: string;
  awaiting?: "confirm" | "bridging";
};

export function encodeCallForwardingOutboundState(state: CallForwardingOutboundState): string {
  return Buffer.from(JSON.stringify(state)).toString("base64");
}

export function decodeCallForwardingOutboundState(raw?: string): CallForwardingOutboundState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as CallForwardingOutboundState;
    if (parsed?.kind === "call_forwarding_outbound" && parsed.outboundCallId) return parsed;
    return null;
  } catch {
    return null;
  }
}
