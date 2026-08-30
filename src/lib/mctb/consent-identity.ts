/**
 * Explicit MCTB consent identity model.
 *
 * Three numbers:
 * - consentingCallerNumber — who pressed 1 (only when verified)
 * - customerBusinessNumber — customer's line that was called / forwarded from
 * - transovoIngressNumber — Transovo DID that received the inbound leg
 */

export const CONSENT_CALLER_IDENTITY_UNAVAILABLE = "IDENTITY_UNAVAILABLE";

export type CallerIdentityStatus = "verified" | "unavailable" | "deprecated_path";

export type ConsentIdentityResolution = {
  consentingCallerNumber: string | null;
  customerBusinessNumber: string | null;
  transovoIngressNumber: string;
  callerIdentityStatus: CallerIdentityStatus;
  consentIdentityVerified: boolean;
  signalingFrom: string;
  identityReason?: string;
};

export function normalizeConsentPhoneDigits(raw: string | null | undefined): string {
  return String(raw || "").replace(/\D/g, "");
}

function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = normalizeConsentPhoneDigits(a);
  const db = normalizeConsentPhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length === 10 && db === `1${da}`) return true;
  if (db.length === 10 && da === `1${db}`) return true;
  return da.endsWith(db.slice(-10)) || db.endsWith(da.slice(-10));
}

export function resolveConsentIdentity(input: {
  signalingFrom: string;
  transovoIngressE164: string;
  customerBusinessE164?: string | null;
  path?: string | null;
  hasDiversionHeader?: boolean;
}): ConsentIdentityResolution {
  const signalingFrom = String(input.signalingFrom || "").trim();
  const transovoIngressNumber = String(input.transovoIngressE164 || "").trim();
  const customerBusinessNumber = String(input.customerBusinessE164 || "").trim() || null;
  const path = String(input.path || "").trim();
  const isTexmlPath = path === "texml_mctb_consent" || path === "texml_mctb_ingress";
  const hasDiversion = Boolean(input.hasDiversionHeader);

  const base = {
    signalingFrom,
    transovoIngressNumber,
    customerBusinessNumber,
  };

  if (!signalingFrom || !transovoIngressNumber) {
    return {
      ...base,
      consentingCallerNumber: null,
      callerIdentityStatus: "unavailable",
      consentIdentityVerified: false,
      identityReason: "missing_signaling_from_or_transovo_destination",
    };
  }

  if (phonesMatch(signalingFrom, transovoIngressNumber)) {
    return {
      ...base,
      consentingCallerNumber: null,
      callerIdentityStatus: "unavailable",
      consentIdentityVerified: false,
      identityReason: "signaling_from_matches_transovo_ingress",
    };
  }

  if (customerBusinessNumber && phonesMatch(signalingFrom, customerBusinessNumber)) {
    return {
      ...base,
      consentingCallerNumber: null,
      callerIdentityStatus: "unavailable",
      consentIdentityVerified: false,
      identityReason: "signaling_from_matches_customer_business_line",
    };
  }

  if (path === "texml_mctb_ingress") {
    return {
      ...base,
      consentingCallerNumber: signalingFrom,
      callerIdentityStatus: "verified",
      consentIdentityVerified: true,
      identityReason: "texml_mctb_ingress_ani_preserved",
    };
  }

  if (isTexmlPath && !hasDiversion && !customerBusinessNumber) {
    return {
      ...base,
      consentingCallerNumber: null,
      callerIdentityStatus: "deprecated_path",
      consentIdentityVerified: false,
      identityReason: "texml_without_forwarding_metadata_not_authoritative",
    };
  }

  return {
    ...base,
    consentingCallerNumber: signalingFrom,
    callerIdentityStatus: isTexmlPath ? "deprecated_path" : "verified",
    consentIdentityVerified: true,
    identityReason: isTexmlPath
      ? "texml_with_forwarding_metadata"
      : "sip_ingress_ani_preserved",
  };
}

export function consentIdentityMetadata(
  identity: ConsentIdentityResolution,
): Record<string, unknown> {
  return {
    consentingCallerNumber: identity.consentingCallerNumber,
    customerBusinessNumber: identity.customerBusinessNumber,
    transovoIngressNumber: identity.transovoIngressNumber,
    callerIdentityStatus: identity.callerIdentityStatus,
    consentIdentityVerified: identity.consentIdentityVerified,
    signalingFrom: identity.signalingFrom,
    identityReason: identity.identityReason ?? null,
  };
}

export function callerNumberForConsentStorage(identity: ConsentIdentityResolution): string {
  if (identity.consentIdentityVerified && identity.consentingCallerNumber) {
    return identity.consentingCallerNumber;
  }
  return CONSENT_CALLER_IDENTITY_UNAVAILABLE;
}

export function businessNumberForConsentStorage(identity: ConsentIdentityResolution): string {
  return identity.customerBusinessNumber || identity.transovoIngressNumber;
}

/** Map stored consent row → explicit identity fields (legacy rows included). */
export function hydrateConsentIdentityFromRow(input: {
  callerNumber: string;
  businessNumber: string;
  metadataJson?: unknown;
}): {
  consentingCallerNumber: string | null;
  customerBusinessNumber: string | null;
  transovoIngressNumber: string;
  callerIdentityStatus: CallerIdentityStatus;
  consentIdentityVerified: boolean;
  consentMethod: string;
} {
  const meta =
    input.metadataJson && typeof input.metadataJson === "object" && !Array.isArray(input.metadataJson)
      ? (input.metadataJson as Record<string, unknown>)
      : {};

  const transovoIngressNumber =
    (typeof meta.transovoIngressNumber === "string" && meta.transovoIngressNumber) ||
    (typeof meta.transovoNumberE164 === "string" && meta.transovoNumberE164) ||
    input.businessNumber;

  const customerBusinessNumber =
    (typeof meta.customerBusinessNumber === "string" && meta.customerBusinessNumber) ||
    (typeof meta.forwardedFrom === "string" && meta.forwardedFrom) ||
    null;

  const storedVerified =
    typeof meta.consentIdentityVerified === "boolean" ? meta.consentIdentityVerified : null;

  const consentIdentityVerified =
    storedVerified ??
    (input.callerNumber !== CONSENT_CALLER_IDENTITY_UNAVAILABLE &&
      !phonesMatch(input.callerNumber, customerBusinessNumber) &&
      !phonesMatch(input.callerNumber, transovoIngressNumber));

  const consentingCallerNumber =
    (typeof meta.consentingCallerNumber === "string" && meta.consentingCallerNumber) ||
    (consentIdentityVerified && input.callerNumber !== CONSENT_CALLER_IDENTITY_UNAVAILABLE
      ? input.callerNumber
      : null);

  const callerIdentityStatus =
    (meta.callerIdentityStatus as CallerIdentityStatus | undefined) ||
    (consentIdentityVerified ? "verified" : "unavailable");

  return {
    consentingCallerNumber,
    customerBusinessNumber,
    transovoIngressNumber,
    callerIdentityStatus,
    consentIdentityVerified,
    consentMethod: "Press 1",
  };
}
