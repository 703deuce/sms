"use client";

import { Field, TextInput } from "./ui";
import { DEFAULT_SMS_CONSENT_TEXT } from "../types";

export default function PublicLegalCard({
  termsUrl,
  setTermsUrl,
  privacyUrl,
  setPrivacyUrl,
  consentText,
  setConsentText,
  consentVersion,
  setConsentVersion,
}: {
  termsUrl: string;
  setTermsUrl: (v: string) => void;
  privacyUrl: string;
  setPrivacyUrl: (v: string) => void;
  consentText: string;
  setConsentText: (v: string) => void;
  consentVersion: string;
  setConsentVersion: (v: string) => void;
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2 className="card-title">Public booking & consent</h2>
          <p className="card-sub">
            Legal links and SMS consent copy shown on your public booking page and stored for compliance.
          </p>
        </div>
      </div>
      <div className="card-body form-grid">
        <div className="form-row-2">
          <Field label="Terms of service URL" hint="Linked in your booking page footer.">
            <TextInput
              name="termsUrl"
              type="url"
              value={termsUrl}
              onChange={(e) => setTermsUrl(e.target.value)}
              placeholder="https://example.com/terms"
            />
          </Field>
          <Field label="Privacy policy URL" hint="Linked in your booking page footer.">
            <TextInput
              name="privacyUrl"
              type="url"
              value={privacyUrl}
              onChange={(e) => setPrivacyUrl(e.target.value)}
              placeholder="https://example.com/privacy"
            />
          </Field>
        </div>
        <Field
          label="SMS consent text"
          hint="Exact wording customers must agree to before receiving appointment texts."
        >
          <textarea
            name="consentText"
            className="input textarea"
            rows={4}
            value={consentText}
            onChange={(e) => setConsentText(e.target.value)}
            placeholder={DEFAULT_SMS_CONSENT_TEXT}
          />
        </Field>
        <Field label="Consent version" hint="Increment when consent copy changes for audit records.">
          <TextInput
            name="consentVersion"
            value={consentVersion}
            onChange={(e) => setConsentVersion(e.target.value)}
            placeholder="2026-01"
          />
        </Field>
      </div>
    </section>
  );
}
