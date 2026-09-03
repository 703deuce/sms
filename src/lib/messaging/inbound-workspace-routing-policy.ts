/**
 * Pure inbound workspace routing policy — safe to import from tests/scripts.
 */
import { isPlatformDemoPhoneRecord } from "@/lib/messaging/compliance/phone-number-class";

export const INBOUND_OUTBOUND_PAIRING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

function readSettings(settingsJson: unknown): Record<string, unknown> {
  return settingsJson && typeof settingsJson === "object" && !Array.isArray(settingsJson)
    ? (settingsJson as Record<string, unknown>)
    : {};
}

function telephonyRoutingMode(settingsJson: unknown): string {
  const settings = readSettings(settingsJson);
  const telephony = settings.telephony as Record<string, unknown> | undefined;
  const provisioning = settings.provisioning as Record<string, unknown> | undefined;
  return String(
    telephony?.routingMode || provisioning?.routingMode || settings.routingOwner || "",
  ).toLowerCase();
}

function isArchivedIngressRow(settingsJson: unknown): boolean {
  const settings = readSettings(settingsJson);
  if (settings.archivedPlatformDemoRow === true) return true;
  const role = String(settings.mctbRole || "").toLowerCase();
  if (role === "archived" || role === "platform_demo") return true;
  return telephonyRoutingMode(settingsJson) === "archived";
}

export type InboundPhoneCandidate = {
  id: string;
  workspaceId: string;
  e164: string;
  settingsJson?: unknown;
  status?: string | null;
};

export type InboundWorkspaceRouteReason =
  | "single_phone_row"
  | "outbound_pairing"
  | "keyword_match"
  | "mirror_disambiguation"
  | "registration_unique"
  | "registration_fallback"
  | "ambiguous_duplicate_e164";

export type InboundWorkspaceRouteResult =
  | {
      ok: true;
      workspaceId: string;
      phoneE164: string;
      phoneNumberId: string;
      reason: Exclude<InboundWorkspaceRouteReason, "ambiguous_duplicate_e164">;
    }
  | {
      ok: false;
      reason: "ambiguous_duplicate_e164" | "no_match";
      detail?: string;
    };

export function isMirrorOrArchivedPhoneRow(candidate: InboundPhoneCandidate): boolean {
  if (String(candidate.status || "").toLowerCase() === "released") return true;
  if (isArchivedIngressRow(candidate.settingsJson)) return true;
  return isPlatformDemoPhoneRecord({
    e164: candidate.e164,
    settingsJson: candidate.settingsJson,
  });
}

export function pickWorkspaceFromOutboundPairing(
  hits: Array<{ workspaceId: string; createdAt: Date }>,
): string | null {
  if (!hits.length) return null;
  const sorted = [...hits].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return sorted[0]?.workspaceId ?? null;
}

export function pickWorkspaceFromKeywordMatches(
  matches: Array<{ workspaceId: string }>,
): string | null {
  const ids = [...new Set(matches.map((m) => m.workspaceId))];
  return ids.length === 1 ? ids[0]! : null;
}

export function pickWorkspaceFromMirrorDisambiguation(
  candidates: InboundPhoneCandidate[],
): InboundPhoneCandidate | null {
  const primary = candidates.filter((row) => !isMirrorOrArchivedPhoneRow(row));
  if (primary.length === 1) return primary[0]!;
  return null;
}

export function resolvePhoneCandidateWithoutLookup(input: {
  toE164: string;
  candidates: InboundPhoneCandidate[];
  outboundWorkspaceId?: string | null;
  keywordWorkspaceId?: string | null;
  registrationWorkspaceId?: string | null;
}): InboundWorkspaceRouteResult {
  const active = input.candidates.filter(
    (row) => String(row.status || "Active").toLowerCase() !== "released",
  );

  if (!active.length) {
    return { ok: false, reason: "no_match", detail: "no_active_phone_rows" };
  }

  if (active.length === 1) {
    const phone = active[0]!;
    return {
      ok: true,
      workspaceId: phone.workspaceId,
      phoneE164: phone.e164,
      phoneNumberId: phone.id,
      reason: "single_phone_row",
    };
  }

  if (input.outboundWorkspaceId) {
    const phone =
      active.find((row) => row.workspaceId === input.outboundWorkspaceId) ?? active[0]!;
    return {
      ok: true,
      workspaceId: input.outboundWorkspaceId,
      phoneE164: phone.e164,
      phoneNumberId: phone.id,
      reason: "outbound_pairing",
    };
  }

  if (input.keywordWorkspaceId) {
    const phone =
      active.find((row) => row.workspaceId === input.keywordWorkspaceId) ?? active[0]!;
    return {
      ok: true,
      workspaceId: input.keywordWorkspaceId,
      phoneE164: phone.e164,
      phoneNumberId: phone.id,
      reason: "keyword_match",
    };
  }

  const mirrorWinner = pickWorkspaceFromMirrorDisambiguation(active);
  if (mirrorWinner) {
    return {
      ok: true,
      workspaceId: mirrorWinner.workspaceId,
      phoneE164: mirrorWinner.e164,
      phoneNumberId: mirrorWinner.id,
      reason: "mirror_disambiguation",
    };
  }

  if (input.registrationWorkspaceId) {
    const phone =
      active.find((row) => row.workspaceId === input.registrationWorkspaceId) ?? active[0]!;
    return {
      ok: true,
      workspaceId: input.registrationWorkspaceId,
      phoneE164: phone.e164,
      phoneNumberId: phone.id,
      reason: "registration_unique",
    };
  }

  const workspaceIds = [...new Set(active.map((row) => row.workspaceId))];
  return {
    ok: false,
    reason: "ambiguous_duplicate_e164",
    detail: `duplicate_e164:${input.toE164}:workspaces=${workspaceIds.join(",")}`,
  };
}
