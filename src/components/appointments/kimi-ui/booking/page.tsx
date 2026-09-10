"use client";

import React, { useState } from "react";
import { Globe } from "lucide-react";
import PublicBookingCard from "./components/PublicBookingCard";
import BusinessInfoCard from "./components/BusinessInfoCard";
import SmsConsentCard from "./components/SmsConsentCard";
import AiProtectionCard from "./components/AiProtectionCard";
import LivePreview from "./components/LivePreview";
import { BookingBrandingPanel } from "@/components/appointments/booking-branding-panel";
import { BookingAdvancedCssPanel } from "@/components/appointments/booking-advanced-css-panel";
import { BookingShareEmbedSection } from "@/components/appointments/booking-share-embed-section";
import type { BookingPageActions, BookingPageModel } from "@/features/appointments/kimi/booking/types";
import "./reference.css";

type ShareTypeRow = { id: string; name: string; bookingTypeKind?: string };

type BookingSection = "general" | "branding" | "share" | "confirmation" | "advanced";

const SECTIONS: Array<{ id: BookingSection; label: string }> = [
  { id: "general", label: "General" },
  { id: "branding", label: "Branding" },
  { id: "share", label: "Share & embed" },
  { id: "confirmation", label: "Confirmation" },
  { id: "advanced", label: "Advanced" },
];

type Props = {
  model: BookingPageModel;
  actions: BookingPageActions;
  shareTypes?: ShareTypeRow[];
  saving?: boolean;
  saved?: boolean;
  copied?: boolean;
};

export default function BookingView({
  model,
  actions,
  shareTypes = [],
  saving = false,
  saved = false,
  copied = false,
}: Props) {
  const [section, setSection] = useState<BookingSection>("general");

  return (
    <div className="booking-page">
      <div className="booking-header">
        <div className="booking-title-row">
          <Globe size={20} className="text-foreground" strokeWidth={1.8} />
          <h1 className="booking-title">Booking pages</h1>
        </div>
        <p className="booking-subtitle">
          Manage how customers can book appointments with {model.workspaceName}.
        </p>
        <nav className="flex flex-wrap gap-2 mt-4" aria-label="Booking page sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium border ${
                section === s.id
                  ? "border-[#5b4bff] bg-[#f7f6ff] text-[#1a1830]"
                  : "border-[#eceaf3] bg-white text-[#6b6880] hover:bg-[#faf9fc]"
              }`}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="booking-grid">
        <div className="booking-left">
          {section === "general" ? (
            <>
              <PublicBookingCard
                model={model}
                copied={copied}
                saving={saving}
                onToggle={actions.onToggleBooking}
                onCopy={actions.onCopyLink}
                onOpen={actions.onOpenBooking}
              />
              <BusinessInfoCard
                businessInfo={model.businessInfo}
                saving={saving}
                saved={saved}
                onFieldChange={actions.onBusinessFieldChange}
                onSave={actions.onSaveBusinessInfo}
              />
            </>
          ) : null}
          {section === "branding" ? <BookingBrandingPanel /> : null}
          {section === "share" ? (
            <BookingShareEmbedSection
              workspaceSlug={model.workspaceSlug}
              workspaceName={model.workspaceName}
              types={shareTypes}
            />
          ) : null}
          {section === "confirmation" ? (
            <SmsConsentCard
              smsConsent={model.smsConsent}
              saving={saving}
              saved={saved}
              onFieldChange={actions.onConsentFieldChange}
              onSave={actions.onSaveConsent}
            />
          ) : null}
          {section === "advanced" ? (
            <>
              <BookingAdvancedCssPanel />
              <AiProtectionCard
                protectionMode={model.protectionMode}
                protectionOptions={model.protectionOptions}
                suspiciousBookings={model.suspiciousBookings}
                onModeChange={actions.onProtectionModeChange}
              />
            </>
          ) : null}
        </div>
        <div className="booking-right">
          <div className="booking-preview-sticky">
            <LivePreview
              businessInfo={model.businessInfo}
              appointmentTypes={model.appointmentTypes}
              whyBookItems={model.whyBookItems}
              smsConsent={model.smsConsent}
            />
            <p className="mt-3 text-center text-[12px] leading-relaxed text-muted-foreground">
              Preview is an approximation and may vary slightly from the live booking page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
