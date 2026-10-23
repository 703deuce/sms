/** P25 — human-readable call origin for power-dialer call history. */

export type PowerDialerCallSourceKind =
  | "power_dialer"
  | "manual_dial"
  | "callback"
  | "cadence"
  | "click_to_call"
  | "api"
  | "inbound"
  | "unknown";

export type PowerDialerCallSource = {
  kind: PowerDialerCallSourceKind;
  label: string;
  campaignId?: string;
  campaignName?: string;
  listId?: string;
  listName?: string;
  answerClassification?: string | null;
  screeningDetected?: boolean;
  screeningOutcome?: string | null;
  amdDetectionMode?: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  power_dialer: "Power dialer session",
  dialer: "Manual dial",
  callback: "Scheduled callback",
  inbound: "Inbound",
  api: "API",
  click_to_call: "Click to call",
  cadence: "Cadence step",
};

export function resolveCallSourceKind(
  source: string | null,
  metadata?: Record<string, unknown> | null,
): PowerDialerCallSourceKind {
  const sub = typeof metadata?.dialOrigin === "string" ? metadata.dialOrigin : null;
  if (sub === "cadence") return "cadence";
  if (sub === "click_to_call") return "click_to_call";
  if (sub === "api") return "api";
  if (source === "callback") return "callback";
  if (source === "dialer") return "manual_dial";
  if (source === "power_dialer") return "power_dialer";
  if (source === "inbound") return "inbound";
  return "unknown";
}

export function labelForCallSource(kind: PowerDialerCallSourceKind): string {
  if (kind === "manual_dial") return SOURCE_LABEL.dialer;
  return SOURCE_LABEL[kind] || "Unknown";
}

export function buildPowerDialerCallSource(input: {
  source: string | null;
  metadata?: Record<string, unknown> | null;
  campaignId?: string | null;
  campaignName?: string | null;
  listId?: string | null;
  listName?: string | null;
  answerClassification?: string | null;
  attemptMetadata?: Record<string, unknown> | null;
}): PowerDialerCallSource {
  const kind = resolveCallSourceKind(input.source, input.metadata);
  const am = input.attemptMetadata || {};
  return {
    kind,
    label: labelForCallSource(kind),
    campaignId: input.campaignId || undefined,
    campaignName: input.campaignName || undefined,
    listId: input.listId || undefined,
    listName: input.listName || undefined,
    answerClassification: input.answerClassification ?? null,
    screeningDetected:
      am.iosScreeningWireActive === true &&
      (input.answerClassification === "screener" || am.screeningPending === true),
    screeningOutcome:
      typeof am.screeningOutcome === "string" ? am.screeningOutcome : null,
    amdDetectionMode: typeof am.amdDetectionMode === "string" ? am.amdDetectionMode : null,
  };
}
