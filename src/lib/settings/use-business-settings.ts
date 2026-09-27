"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SMS_CONSENT_TEXT } from "@/components/settings/kimi-ui/business/types";
import type { MessagingRegistration } from "@/lib/domain";
import { mapBusinessRegistration } from "@/features/settings/kimi/shared/map-registration";
import type { SuspiciousBookingRow } from "@/components/settings/kimi-ui/business/components/SuspiciousBookingsCard";

export type BusinessSettingsSaveState = "idle" | "saving" | "saved" | "error";

export function useBusinessSettings({
  initialWorkspaceName,
  registration,
}: {
  initialWorkspaceName: string;
  registration: MessagingRegistration | null;
}) {
  const [workspaceName, setWorkspaceName] = useState(initialWorkspaceName);
  const [supportEmail, setSupportEmail] = useState(registration?.contactEmail || "");
  const [businessPhone, setBusinessPhone] = useState(registration?.contactPhone || "");
  const [address, setAddress] = useState(() => {
    const parts = [
      registration?.street,
      registration?.city && registration?.region
        ? `${registration.city}, ${registration.region} ${registration.postalCode || ""}`.trim()
        : registration?.city,
    ].filter(Boolean);
    return parts.join("\n");
  });
  const [websiteUrl, setWebsiteUrl] = useState(registration?.websiteUrl || "");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [termsUrl, setTermsUrl] = useState("/terms");
  const [privacyUrl, setPrivacyUrl] = useState("/privacy");
  const [consentText, setConsentText] = useState(DEFAULT_SMS_CONSENT_TEXT);
  const [consentVersion, setConsentVersion] = useState("v1");
  const [saveState, setSaveState] = useState<BusinessSettingsSaveState>("idle");
  const [error, setError] = useState("");
  const [platformLoading, setPlatformLoading] = useState(true);
  const [suspiciousBookings, setSuspiciousBookings] = useState<SuspiciousBookingRow[]>([]);

  const registrationCard = mapBusinessRegistration(registration);

  const loadPlatform = useCallback(() => {
    setPlatformLoading(true);
    fetch("/api/appointments/settings")
      .then((r) => r.json())
      .then((json) => {
        const data = json.data;
        if (!data) return;
        if (data.timezone) setTimezone(data.timezone);
        if (typeof data.bookingEnabled === "boolean") setBookingEnabled(data.bookingEnabled);
        if (data.termsUrl) setTermsUrl(data.termsUrl);
        if (data.privacyUrl) setPrivacyUrl(data.privacyUrl);
        if (data.consentText) setConsentText(data.consentText);
        if (data.consentVersion) setConsentVersion(data.consentVersion);
        const rows = (data.suspiciousBookings || []) as SuspiciousBookingRow[];
        setSuspiciousBookings(
          rows.map((row) => ({
            ...row,
            at: row.at
              ? new Date(row.at).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              : row.at,
          })),
        );
      })
      .catch(() => undefined)
      .finally(() => setPlatformLoading(false));
  }, []);

  useEffect(() => {
    loadPlatform();
  }, [loadPlatform]);

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaveState("saving");
    setError("");

    const addressLines = address.split("\n").map((l) => l.trim()).filter(Boolean);
    const street = addressLines[0] || registration?.street || "";
    const cityLine = addressLines[1] || "";
    const cityMatch = cityLine.match(/^([^,]+),\s*([A-Za-z]{2})\s*(.*)$/);
    const defaultAddress = [
      registration?.street,
      registration?.city && registration?.region
        ? `${registration.city}, ${registration.region} ${registration.postalCode || ""}`.trim()
        : registration?.city,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (workspaceName.trim() && workspaceName !== initialWorkspaceName) {
        const wsRes = await fetch("/api/workspace", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: workspaceName.trim() }),
        });
        const wsJson = await wsRes.json();
        if (!wsRes.ok) throw new Error(wsJson.error || "Failed to update workspace name");
      }

      const userEditedRegFields =
        supportEmail !== (registration?.contactEmail || "") ||
        businessPhone !== (registration?.contactPhone || "") ||
        address !== defaultAddress ||
        websiteUrl !== (registration?.websiteUrl || "");

      if (userEditedRegFields) {
        const regRes = await fetch("/api/messaging/registration", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_business",
            legalBusinessName: workspaceName || registration?.legalBusinessName || initialWorkspaceName,
            dbaName: registration?.dbaName || "",
            businessType: registration?.businessType || "llc",
            businessIndustry: registration?.businessIndustry || "other",
            businessIdentity: registration?.businessIdentity || "",
            businessRegistrationId: registration?.businessRegistrationId || "000000000",
            websiteUrl: websiteUrl || registration?.websiteUrl || "https://example.com",
            street: street.length >= 2 ? street : registration?.street || "123 Main Street",
            city:
              (cityMatch?.[1]?.trim() || registration?.city || "").length >= 2
                ? cityMatch?.[1]?.trim() || registration?.city
                : "San Francisco",
            region:
              (cityMatch?.[2]?.trim() || registration?.region || "").length >= 2
                ? cityMatch?.[2]?.trim() || registration?.region
                : "CA",
            postalCode:
              (cityMatch?.[3]?.trim() || registration?.postalCode || "").length >= 3
                ? cityMatch?.[3]?.trim() || registration?.postalCode
                : "94102",
            country: registration?.country || "US",
            contactFirstName: registration?.contactFirstName || "Account",
            contactLastName: registration?.contactLastName || "Owner",
            contactEmail: supportEmail || registration?.contactEmail || "support@example.com",
            contactPhone: businessPhone || registration?.contactPhone || "+10000000000",
            contactTitle: registration?.contactTitle || "",
          }),
        });
        const regJson = await regRes.json();
        if (!regRes.ok) throw new Error(regJson.error || "Failed to save business profile");
      }

      const platformRes = await fetch("/api/appointments/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timezone,
          bookingEnabled,
          termsUrl,
          privacyUrl,
          consentText,
          consentVersion,
        }),
      });
      const platformJson = await platformRes.json();
      if (!platformRes.ok) throw new Error(platformJson.error || "Failed to save booking settings");

      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaveState("error");
    }
  }

  return {
    workspaceName,
    setWorkspaceName,
    supportEmail,
    setSupportEmail,
    businessPhone,
    setBusinessPhone,
    address,
    setAddress,
    websiteUrl,
    setWebsiteUrl,
    timezone,
    setTimezone,
    bookingEnabled,
    setBookingEnabled,
    termsUrl,
    setTermsUrl,
    privacyUrl,
    setPrivacyUrl,
    consentText,
    setConsentText,
    consentVersion,
    setConsentVersion,
    saveState,
    error,
    platformLoading,
    suspiciousBookings,
    registrationCard,
    save,
  };
}
