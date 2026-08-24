/** What this phone number should do for inbound PSTN calls. */
export type CallHandlingMode = "none" | "mctb" | "smart_routing";

export type CallHandlingModeSnapshot = {
  mode: CallHandlingMode;
  mctbSipIngress: boolean;
  routingOwner: string | null;
  telephonyRoutingMode: string | null;
};

function readSettings(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? (settingsJson as Record<string, unknown>)
    : {};
}

function readTelephony(settings: Record<string, unknown>): Record<string, unknown> {
  const telephony = settings.telephony;
  return telephony && typeof telephony === "object" && !Array.isArray(telephony)
    ? (telephony as Record<string, unknown>)
    : {};
}

function isPhoneMctbSipIngress(settingsJson: unknown): boolean {
  const settings = readSettings(settingsJson);
  return settings.mctbSipIngress === true;
}

export function readCallHandlingMode(settingsJson: unknown): CallHandlingMode {
  const settings = readSettings(settingsJson);
  const explicit = String(settings.callHandlingMode || "").toLowerCase();
  if (explicit === "mctb" || explicit === "smart_routing" || explicit === "none") {
    return explicit;
  }
  if (isPhoneMctbSipIngress(settingsJson)) return "mctb";
  const owner = String(settings.routingOwner || "");
  if (owner === "smart_routing") return "smart_routing";
  return "none";
}

export function snapshotCallHandlingMode(settingsJson: unknown): CallHandlingModeSnapshot {
  const settings = readSettings(settingsJson);
  const telephony = readTelephony(settings);
  return {
    mode: readCallHandlingMode(settingsJson),
    mctbSipIngress: isPhoneMctbSipIngress(settingsJson),
    routingOwner: (settings.routingOwner as string) || null,
    telephonyRoutingMode: (telephony.routingMode as string) || null,
  };
}
