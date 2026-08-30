import "server-only";

/**
 * Canonical MCTB missed-call capture pipeline (TeXML only).
 *
 * @see docs/MCTB_FINAL_PRODUCTION_PIPELINE.md
 */

export type { CaptureMctbMissedCallResult, HandleMctbInboundEventResult } from "./handle";
export {
  captureMctbMissedCall,
  handleMctbInboundEvent,
  enqueueMctbRecoverySms,
} from "./handle";

export type {
  MctbInboundCallEvent,
  MctbCaptureMode,
  MctbInboundProvider,
  MctbCaptureEligibilityStatus,
  MctbEventOnlyEligibilityStatus,
} from "./types";

export {
  MCTB_CAPTURE_LOG_SOURCE,
  MCTB_EVENT_ONLY_LOG_SOURCE,
  clampMctbRecoveryDelaySeconds,
  MCTB_RECOVERY_DELAY_MIN_SECONDS,
  MCTB_RECOVERY_DELAY_DEFAULT_SECONDS,
  MCTB_RECOVERY_DELAY_MAX_SECONDS,
} from "./types";

export { normalizeTelnyxMctbInboundEvent } from "./normalize";
export {
  buildMctbCaptureIdempotencyKey,
  buildEventOnlyIdempotencyKey,
  evaluateMctbRecoveryEligibility,
  resolveMctbConsentMode,
} from "./eligibility";
export {
  validateExistingConsentAttestation,
  recordWorkspaceExistingConsentAttestation,
  EXISTING_CONSENT_ATTESTATION_VERSION,
} from "./attestation";
export type {
  ExistingConsentAttestationRecord,
  ExistingConsentAttestationValidation,
} from "./attestation";
export { logMctbCapture, logMctbEventOnly } from "./logging";
