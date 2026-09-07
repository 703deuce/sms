"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Globe } from "lucide-react";
import "./reference.css";
import {
  workspace,
  bookingUrl,
  businessInfo as initialBusinessInfo,
  smsConsent as initialConsent,
  type ProtectionMode,
} from "./mock-data";
import { BookingLoading, BookingError } from "./components/States";
import PublicBookingCard from "./components/PublicBookingCard";
import BusinessInfoCard from "./components/BusinessInfoCard";
import SmsConsentCard from "./components/SmsConsentCard";
import AiProtectionCard from "./components/AiProtectionCard";
import AdvancedPanel from "./components/AdvancedPanel";
import ShareEmbedCard from "./components/ShareEmbedCard";
import LivePreview from "./components/LivePreview";

export default function BookingPage() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [businessInfo, setBusinessInfo] = useState(initialBusinessInfo);
  const [smsConsent, setSmsConsent] = useState(initialConsent);
  const [protectionMode, setProtectionMode] = useState<ProtectionMode>("standard");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Simulated load of /api/appointments/settings + /api/appointments/types
  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    const t = window.setTimeout(() => {
      setLoading(false);
    }, 700);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savePatch = useCallback(async (_patch: Record<string, unknown>) => {
    setSaving(true);
    setSaved(false);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }, []);

  const handleToggle = useCallback(
    (next: boolean) => {
      setEnabled(next);
      void savePatch({ bookingEnabled: next });
    },
    [savePatch],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
    } catch {
      /* clipboard unavailable in sandbox */
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleOpen = useCallback(() => {
    window.open(`/book/${workspace.slug}`, "_blank");
  }, []);

  const handleBusinessField = useCallback(
    (field: keyof typeof businessInfo, value: string) => {
      setBusinessInfo((b) => ({ ...b, [field]: value }));
    },
    [],
  );

  const handleConsentField = useCallback(
    (field: keyof typeof smsConsent, value: string) => {
      setSmsConsent((c) => ({ ...c, [field]: value }));
    },
    [],
  );

  const handleProtectionMode = useCallback(
    (mode: ProtectionMode) => {
      setProtectionMode(mode);
      void savePatch({ bookingProtection: { mode } });
    },
    [savePatch],
  );

  if (loading) return <BookingLoading />;
  if (failed) return <BookingError onRetry={load} />;

  return (
    <div className="booking-page">
      <header className="booking-header">
        <div className="booking-title-row">
          <Globe size={20} strokeWidth={1.8} className="text-gray-900" />
          <h1 className="booking-title">Booking pages</h1>
        </div>
        <p className="booking-subtitle">
          Manage how customers can book appointments with {workspace.name}.
        </p>
      </header>

      <div className="booking-grid">
        <div className="booking-left">
          <PublicBookingCard
            enabled={enabled}
            url={bookingUrl}
            workspaceSlug={workspace.slug}
            copied={copied}
            saving={saving}
            onToggle={handleToggle}
            onCopy={handleCopy}
            onOpen={handleOpen}
          />
          <BusinessInfoCard
            businessInfo={businessInfo}
            saving={saving}
            saved={saved}
            onFieldChange={handleBusinessField}
            onSave={() => void savePatch(businessInfo)}
          />
          <SmsConsentCard
            smsConsent={smsConsent}
            saving={saving}
            saved={saved}
            onFieldChange={handleConsentField}
            onSave={() => void savePatch(smsConsent)}
          />
          <AiProtectionCard
            mode={protectionMode}
            onModeChange={handleProtectionMode}
          />
          <AdvancedPanel />
          <ShareEmbedCard />
        </div>

        <div className="booking-right">
          <div className="booking-preview-sticky">
            <LivePreview
              businessInfo={businessInfo}
              consentWording={smsConsent.wording}
            />
            <p className="mt-3 text-center text-[12px] leading-relaxed text-gray-500">
              Preview is an approximation and may vary slightly from the live
              booking page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
