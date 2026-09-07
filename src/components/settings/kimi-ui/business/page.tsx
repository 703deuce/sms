"use client";

import { useState } from "react";
import "./reference.css";
import AppShell from "./components/AppShell";
import SettingsTabs from "./components/SettingsTabs";
import BusinessProfileCard from "./components/BusinessProfileCard";
import MessagingRegistrationCard from "./components/MessagingRegistrationCard";
import BookingEnabledCard from "./components/BookingEnabledCard";
import PublicLegalCard from "./components/PublicLegalCard";
import { mockWorkspace, mockRegistration, DEFAULT_SMS_CONSENT_TEXT } from "./types";
import { Building2, AlertCircle, CheckCircle2 } from "lucide-react";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function SettingsBusinessPage() {
  const [workspaceName, setWorkspaceName] = useState(mockWorkspace.name);
  const [supportEmail, setSupportEmail] = useState(mockRegistration.contactEmail);
  const [businessPhone, setBusinessPhone] = useState(mockRegistration.contactPhone);
  const [address, setAddress] = useState(
    `${mockRegistration.street}\n${mockRegistration.city}, ${mockRegistration.region} ${mockRegistration.postalCode}`
  );
  const [websiteUrl, setWebsiteUrl] = useState(mockRegistration.websiteUrl);
  const [timezone, setTimezone] = useState("America/New_York");
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [termsUrl, setTermsUrl] = useState("https://brightlinedental.com/terms");
  const [privacyUrl, setPrivacyUrl] = useState("https://brightlinedental.com/privacy");
  const [consentText, setConsentText] = useState(DEFAULT_SMS_CONSENT_TEXT);
  const [consentVersion, setConsentVersion] = useState("2026-01");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  const brandOk = mockRegistration.brandStatus === "approved";
  const campaignOk = mockRegistration.campaignStatus === "approved";
  const complianceReady = brandOk && campaignOk;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveState("saving");
    setError("");
    // Simulates: PUT /api/workspace { name } + POST /api/messaging/registration { action: "save_business", ... }
    await new Promise((r) => setTimeout(r, 900));
    if (!workspaceName.trim()) {
      setError("Business name is required.");
      setSaveState("error");
      return;
    }
    if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
      setError("Enter a valid support email address.");
      setSaveState("error");
      return;
    }
    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 3000);
  }

  return (
    <AppShell activeNav="Settings">
      <div className="page">
        <div className="page-header">
          <div className="page-header-left">
            <span className="page-icon">
              <Building2 size={18} />
            </span>
            <div>
              <h1 className="page-title">Business settings</h1>
              <p className="page-desc">
                Account-level business information displayed in messages and compliance records.
              </p>
            </div>
          </div>
          <button
            type="submit"
            form="business-settings-form"
            className="btn btn-primary"
            disabled={saveState === "saving"}
          >
            {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save changes"}
          </button>
        </div>

        <SettingsTabs active="Business" />

        {error ? (
          <div className="alert alert-error" role="alert">
            <AlertCircle size={16} />
            <p>{error}</p>
          </div>
        ) : null}

        {saveState === "saved" ? (
          <div className="alert alert-success" role="status">
            <CheckCircle2 size={16} />
            <p>Business settings saved. Compliance records were updated.</p>
          </div>
        ) : null}

        <form id="business-settings-form" onSubmit={save} className="settings-grid">
          <div className="settings-main">
            <BookingEnabledCard enabled={bookingEnabled} onToggle={setBookingEnabled} />
            <BusinessProfileCard
              workspaceName={workspaceName}
              setWorkspaceName={setWorkspaceName}
              supportEmail={supportEmail}
              setSupportEmail={setSupportEmail}
              businessPhone={businessPhone}
              setBusinessPhone={setBusinessPhone}
              address={address}
              setAddress={setAddress}
              websiteUrl={websiteUrl}
              setWebsiteUrl={setWebsiteUrl}
              timezone={timezone}
              setTimezone={setTimezone}
            />
            <PublicLegalCard
              termsUrl={termsUrl}
              setTermsUrl={setTermsUrl}
              privacyUrl={privacyUrl}
              setPrivacyUrl={setPrivacyUrl}
              consentText={consentText}
              setConsentText={setConsentText}
              consentVersion={consentVersion}
              setConsentVersion={setConsentVersion}
            />
          </div>
          <div className="settings-side">
            <MessagingRegistrationCard
              registration={mockRegistration}
              complianceReady={complianceReady}
            />
          </div>
        </form>
      </div>
    </AppShell>
  );
}
