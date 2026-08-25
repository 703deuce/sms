export type CallHandlingMode = "unconfigured" | "call_forwarding" | "smart_routing" | "mctb";

export type CallHandlingModePurchaseOption = "call_forwarding" | "smart_routing" | "mctb";

function readSettings(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object"
    ? (settingsJson as Record<string, unknown>)
    : {};
}

export function isFrozenMctbSipIngress(settingsJson: unknown): boolean {
  const settings = readSettings(settingsJson);
  return settings.mctbSipIngress === true;
}

export function readCallHandlingMode(settingsJson: unknown): CallHandlingMode {
  const settings = readSettings(settingsJson);
  if (isFrozenMctbSipIngress(settingsJson)) return "mctb";
  const explicit = settings.callHandlingMode;
  if (
    explicit === "call_forwarding" ||
    explicit === "smart_routing" ||
    explicit === "mctb"
  ) {
    return explicit;
  }
  if (settings.routingOwner === "smart_routing") return "smart_routing";
  if (settings.routingOwner === "call_forwarding") return "call_forwarding";
  return "unconfigured";
}

export function isCallForwardingCallHandlingActive(settingsJson: unknown): boolean {
  return readCallHandlingMode(settingsJson) === "call_forwarding";
}

export function isSmartRoutingCallHandlingActive(settingsJson: unknown): boolean {
  return readCallHandlingMode(settingsJson) === "smart_routing";
}

export function parseCallHandlingModePurchase(
  value: unknown,
): CallHandlingModePurchaseOption | null {
  if (value === "call_forwarding" || value === "smart_routing" || value === "mctb") {
    return value;
  }
  return null;
}
