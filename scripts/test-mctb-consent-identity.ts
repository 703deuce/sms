#!/usr/bin/env npx tsx
/**
 * Contract tests for MCTB consent identity resolution.
 * Run: npx tsx scripts/test-mctb-consent-identity.ts
 */
import assert from "node:assert/strict";
import {
  CONSENT_CALLER_IDENTITY_UNAVAILABLE,
  callerNumberForConsentStorage,
  hydrateConsentIdentityFromRow,
  resolveConsentIdentity,
} from "../src/lib/mctb/consent-identity";

const CALLER_703 = "+17035551234";
const BUSINESS_571 = "+15715550100";
const TRANSOVO_571 = "+15715559000";

const sipVerified = resolveConsentIdentity({
  signalingFrom: CALLER_703,
  transovoIngressE164: TRANSOVO_571,
  customerBusinessE164: BUSINESS_571,
  path: "livekit_sip_mctb",
});
assert.equal(sipVerified.consentIdentityVerified, true);
assert.equal(sipVerified.consentingCallerNumber, CALLER_703);
assert.equal(sipVerified.customerBusinessNumber, BUSINESS_571);
assert.equal(sipVerified.transovoIngressNumber, TRANSOVO_571);
assert.equal(callerNumberForConsentStorage(sipVerified), CALLER_703);

const texmlGood = resolveConsentIdentity({
  signalingFrom: CALLER_703,
  transovoIngressE164: TRANSOVO_571,
  customerBusinessE164: BUSINESS_571,
  path: "texml_mctb_consent",
  hasDiversionHeader: true,
});
assert.equal(texmlGood.consentIdentityVerified, true);
assert.equal(texmlGood.consentingCallerNumber, CALLER_703);

const texmlBad = resolveConsentIdentity({
  signalingFrom: BUSINESS_571,
  transovoIngressE164: TRANSOVO_571,
  path: "texml_mctb_consent",
  hasDiversionHeader: false,
});
assert.equal(texmlBad.consentIdentityVerified, false);
assert.equal(texmlBad.consentingCallerNumber, null);
assert.equal(texmlBad.callerIdentityStatus, "deprecated_path");
assert.equal(callerNumberForConsentStorage(texmlBad), CONSENT_CALLER_IDENTITY_UNAVAILABLE);

const rewrittenBusiness = resolveConsentIdentity({
  signalingFrom: BUSINESS_571,
  transovoIngressE164: TRANSOVO_571,
  customerBusinessE164: BUSINESS_571,
  path: "texml_mctb_consent",
  hasDiversionHeader: true,
});
assert.equal(rewrittenBusiness.consentIdentityVerified, false);
assert.equal(rewrittenBusiness.identityReason, "signaling_from_matches_customer_business_line");

const hydrated = hydrateConsentIdentityFromRow({
  callerNumber: CALLER_703,
  businessNumber: TRANSOVO_571,
  metadataJson: {
    consentingCallerNumber: CALLER_703,
    customerBusinessNumber: BUSINESS_571,
    transovoIngressNumber: TRANSOVO_571,
    consentIdentityVerified: true,
    callerIdentityStatus: "verified",
  },
});
assert.equal(hydrated.consentingCallerNumber, CALLER_703);
assert.equal(hydrated.customerBusinessNumber, BUSINESS_571);
assert.equal(hydrated.transovoIngressNumber, TRANSOVO_571);

console.log("test-mctb-consent-identity: ok");
