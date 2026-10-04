/**
 * MCTB consent mode — authoritative persisted sources (runtime):
 *
 * 1. Per-DID ingress: phone.settingsJson.mctbInbound.consentMode (+ consentConfigRevision)
 * 2. Workspace Setup save: customFieldsConfig.mctb.consentMode (+ consentConfigRevision)
 *
 * In-memory routing profiles and ingress config cache are accelerators only.
 * Every inbound call re-applies authority from persisted storage (see consent-mode-authority.ts).
 * Legacy onboarding/attestation/solution fields are migration-only (legacy_migration).
 */
import {
  MCTB_CONSENT_MODE_EXISTING,
  MCTB_CONSENT_MODE_VERIFIED,
  normalizeMctbConsentMode,
  type MctbConsentMode,
} from "@/lib/mctb/consent-mode";
import { resolveMctbConsentModeFromCustomFields } from "@/lib/mctb/consent-mode-resolution-core";

/** Where the effective ingress consent mode was read (observability + tests). */
export type MctbIngressConsentAuthoritySource =
  | "phone_mctb_inbound"
  | "workspace_mctb"
  | "legacy_migration"
  | "unconfigured";

export type MctbIngressConsentAuthority = {
  consentMode: MctbConsentMode;
  source: MctbIngressConsentAuthoritySource;
  configRevision: string | null;
  legacyFallbackUsed: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readPhoneInboundConsent(settingsJson: unknown): {
  mode: MctbConsentMode | null;
  revision: string | null;
} {
  const inbound = asRecord(asRecord(settingsJson).mctbInbound);
  const raw = inbound.consentMode;
  if (typeof raw !== "string" || !raw.trim()) {
    return { mode: null, revision: readRevision(inbound) };
  }
  return {
    mode: normalizeMctbConsentMode(raw),
    revision: readRevision(inbound),
  };
}

function readWorkspaceConsent(customFieldsConfig: unknown): {
  mode: MctbConsentMode | null;
  revision: string | null;
} {
  const mctb = asRecord(asRecord(customFieldsConfig).mctb);
  const raw = mctb.consentMode;
  if (typeof raw !== "string" || !raw.trim()) {
    return { mode: null, revision: readRevision(mctb) };
  }
  return {
    mode: normalizeMctbConsentMode(raw),
    revision: readRevision(mctb),
  };
}

function readRevision(row: Record<string, unknown>): string | null {
  const rev = row.consentConfigRevision;
  return typeof rev === "string" && rev.trim() ? rev.trim() : null;
}

/**
 * Authoritative ingress consent resolution (pure).
 *
 * Runtime precedence for a provisioned MCTB ingress phone:
 * 1. phone.settingsJson.mctbInbound.consentMode  (per-DID runtime authority)
 * 2. workspace.customFieldsConfig.mctb.consentMode (customer Save in Setup)
 * 3. legacy_migration (one-shot convergence from onboarding/attestation/solution)
 * 4. unconfigured → press_1 only for never-saved greenfield
 */
export function resolveIngressConsentAuthority(input: {
  phoneSettingsJson: unknown;
  workspaceCustomFieldsConfig: unknown;
  solutionConsentMode?: unknown;
}): MctbIngressConsentAuthority {
  const phone = readPhoneInboundConsent(input.phoneSettingsJson);
  if (phone.mode) {
    return {
      consentMode: phone.mode,
      source: "phone_mctb_inbound",
      configRevision: phone.revision,
      legacyFallbackUsed: false,
    };
  }

  const workspace = readWorkspaceConsent(input.workspaceCustomFieldsConfig);
  if (workspace.mode) {
    return {
      consentMode: workspace.mode,
      source: "workspace_mctb",
      configRevision: workspace.revision,
      legacyFallbackUsed: false,
    };
  }

  const legacy = resolveMctbConsentModeFromCustomFields({
    customFieldsConfig: input.workspaceCustomFieldsConfig,
    solutionConsentMode: input.solutionConsentMode,
  });
  if (legacy.source !== "default") {
    return {
      consentMode: legacy.mode,
      source: "legacy_migration",
      configRevision: null,
      legacyFallbackUsed: true,
    };
  }

  return {
    consentMode: MCTB_CONSENT_MODE_VERIFIED,
    source: "unconfigured",
    configRevision: null,
    legacyFallbackUsed: false,
  };
}

/** Apply authoritative consent onto a routing profile shell (cache must not decide mode). */
export function applyIngressConsentToRoutingProfile<T extends { consentMode: MctbConsentMode }>(
  profile: T,
  authority: MctbIngressConsentAuthority,
): T {
  return {
    ...profile,
    consentMode: authority.consentMode,
  };
}

export function ingressConsentModesEqual(a: MctbConsentMode, b: MctbConsentMode): boolean {
  return a === b;
}

export function isExistingConsentAuthority(authority: MctbIngressConsentAuthority): boolean {
  return authority.consentMode === MCTB_CONSENT_MODE_EXISTING;
}
