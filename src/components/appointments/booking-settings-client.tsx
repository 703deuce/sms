"use client";

import { DEFAULT_SMS_CONSENT_TEXT } from "@/lib/appointments/types";
import { useEffect, useMemo, useState } from "react";
import PublicBookingCard from "./rebuild/booking/components/PublicBookingCard";
import BusinessInfoCard from "./rebuild/booking/components/BusinessInfoCard";
import SmsConsentCard from "./rebuild/booking/components/SmsConsentCard";
import AiProtectionCard from "./rebuild/booking/components/AiProtectionCard";
import ReviewBookingsCard from "./rebuild/booking/components/ReviewBookingsCard";
import LivePreview from "./rebuild/booking/components/LivePreview";
import type {
  PreviewAppointmentType,
  ProtectionMode,
  ProtectionModeOption,
  SuspiciousBooking,
} from "./rebuild/booking/types";
import "./rebuild/booking/reference.css";

type Props = {
  workspaceSlug: string;
  workspaceName: string;
};

const PROTECTION_MODES: ProtectionModeOption[] = [
  {
    value: "standard",
    label: "Standard",
    description: "Challenge suspicious bookings with a confirmation step.",
  },
  {
    value: "strict",
    label: "Strict",
    description: "Block high-risk bookings and challenge medium risk.",
  },
  {
    value: "off",
    label: "Off",
    description: "Accept all bookings without risk screening.",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours} hr ${mins} min` : `${hours} hr`;
}

export function AppointmentBookingSettingsClient({ workspaceSlug, workspaceName }: Props) {
  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [timezone, setTimezone] = useState("America/New_York");
  const [businessDisplayName, setBusinessDisplayName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [consentText, setConsentText] = useState(DEFAULT_SMS_CONSENT_TEXT);
  const [termsUrl, setTermsUrl] = useState("/terms");
  const [privacyUrl, setPrivacyUrl] = useState("/privacy");
  const [bookingProtectionMode, setBookingProtectionMode] = useState<ProtectionMode>("standard");
  const [suspiciousBookings, setSuspiciousBookings] = useState<SuspiciousBooking[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<PreviewAppointmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const bookingPath = workspaceSlug ? `/book/${workspaceSlug}` : "";
  const bookingUrl =
    typeof window !== "undefined" && bookingPath
      ? `${window.location.origin}${bookingPath}`
      : bookingPath;

  useEffect(() => {
    Promise.all([
      fetch("/api/appointments/settings").then((r) => r.json()),
      fetch("/api/appointments/types").then((r) => r.json()),
    ])
      .then(([settingsJson, typesJson]) => {
        const data = settingsJson.data || {};
        setBookingEnabled(Boolean(data.bookingEnabled));
        setTimezone(data.timezone || "America/New_York");
        setBusinessDisplayName(data.businessDisplayName || settingsJson.workspace?.name || workspaceName);
        setBusinessPhone(data.businessPhone || "");
        setBusinessAddress(data.businessAddress || "");
        setConsentText(data.consentText || DEFAULT_SMS_CONSENT_TEXT);
        setTermsUrl(data.termsUrl || "/terms");
        setPrivacyUrl(data.privacyUrl || "/privacy");
        setBookingProtectionMode(data.bookingProtection?.mode || "standard");
        setSuspiciousBookings(data.suspiciousBookings || []);
        setAppointmentTypes(
          (typesJson.data || []).map(
            (t: {
              id: string;
              name: string;
              durationMinutes?: number;
              description?: string | null;
            }) => ({
              id: t.id,
              name: t.name,
              duration: formatDuration(t.durationMinutes),
              description: t.description || "",
            }),
          ),
        );
      })
      .finally(() => setLoading(false));
  }, [workspaceName]);

  async function savePatch(patch: Record<string, unknown>) {
    setSaving(true);
    setSaved(false);
    await fetch("/api/appointments/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    setSaved(true);
  }

  async function copyLink() {
    if (!bookingUrl) return;
    await navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const previewBusinessInfo = useMemo(
    () => ({
      displayName: businessDisplayName || workspaceName,
      initials: initials(businessDisplayName || workspaceName),
      phone: businessPhone,
      address: businessAddress,
    }),
    [businessAddress, businessDisplayName, businessPhone, workspaceName],
  );

  if (loading) {
    return (
      <div className="booking-page min-h-full bg-[#f7f7fa] p-6">
        <div className="mb-5 space-y-2">
          <div className="h-7 w-44 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-lg bg-muted/70" />
        </div>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="booking-card animate-pulse">
                <div className="h-4 w-40 rounded-lg bg-muted" />
                <div className="mt-4 h-10 rounded-[10px] bg-muted/60" />
                <div className="mt-3 h-10 rounded-[10px] bg-muted/60" />
              </div>
            ))}
          </div>
          <div className="booking-card animate-pulse">
            <div className="h-4 w-28 rounded-lg bg-muted" />
            <div className="mt-4 h-64 rounded-xl bg-muted/60" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="booking-page min-h-full bg-[#f7f7fa] p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Booking Page</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Share a public link so customers can book {workspaceName} online.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
            bookingEnabled
              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
              : "bg-muted text-muted-foreground ring-border"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              bookingEnabled ? "bg-emerald-500" : "bg-muted-foreground/50"
            }`}
          />
          {bookingEnabled ? "Live" : "Disabled"}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <PublicBookingCard
            bookingEnabled={bookingEnabled}
            bookingUrl={bookingUrl}
            previewHref={bookingPath}
            hasSlug={Boolean(workspaceSlug)}
            saving={saving}
            copied={copied}
            onToggle={(next) => {
              setBookingEnabled(next);
              savePatch({ bookingEnabled: next });
            }}
            onCopy={copyLink}
          />
          <BusinessInfoCard
            businessDisplayName={businessDisplayName}
            timezone={timezone}
            businessPhone={businessPhone}
            businessAddress={businessAddress}
            saving={saving}
            saved={saved}
            onChange={(patch) => {
              if (patch.businessDisplayName !== undefined) {
                setBusinessDisplayName(patch.businessDisplayName);
              }
              if (patch.timezone !== undefined) setTimezone(patch.timezone);
              if (patch.businessPhone !== undefined) setBusinessPhone(patch.businessPhone);
              if (patch.businessAddress !== undefined) setBusinessAddress(patch.businessAddress);
            }}
            onSave={() =>
              savePatch({
                businessDisplayName,
                timezone,
                businessPhone,
                businessAddress,
              })
            }
          />
          <SmsConsentCard
            consentText={consentText}
            termsUrl={termsUrl}
            privacyUrl={privacyUrl}
            saving={saving}
            saved={saved}
            onChange={(patch) => {
              if (patch.consentText !== undefined) setConsentText(patch.consentText);
              if (patch.termsUrl !== undefined) setTermsUrl(patch.termsUrl);
              if (patch.privacyUrl !== undefined) setPrivacyUrl(patch.privacyUrl);
            }}
            onSave={() => savePatch({ consentText, termsUrl, privacyUrl })}
          />
          <AiProtectionCard
            mode={bookingProtectionMode}
            modes={PROTECTION_MODES}
            onChange={(mode) => {
              setBookingProtectionMode(mode);
              savePatch({ bookingProtection: { mode } });
            }}
          />
          <ReviewBookingsCard bookings={suspiciousBookings} />
        </div>

        <div className="xl:sticky xl:top-6 self-start">
          <LivePreview
            businessInfo={previewBusinessInfo}
            appointmentTypes={appointmentTypes}
            termsUrl={termsUrl}
            privacyUrl={privacyUrl}
          />
        </div>
      </div>
    </div>
  );
}
