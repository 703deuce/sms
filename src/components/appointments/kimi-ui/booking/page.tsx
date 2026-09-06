"use client";

import React from "react";
import { Globe } from "lucide-react";
import PublicBookingCard from "./components/PublicBookingCard";
import BusinessInfoCard from "./components/BusinessInfoCard";
import SmsConsentCard from "./components/SmsConsentCard";
import AiProtectionCard from "./components/AiProtectionCard";
import LivePreview from "./components/LivePreview";
import { BookingAdvancedPanel } from "@/components/appointments/booking-advanced-panel";
import type { BookingPageActions, BookingPageModel } from "@/features/appointments/kimi/booking/types";
import "./reference.css";

type Props = {
  model: BookingPageModel;
  actions: BookingPageActions;
  saving?: boolean;
  saved?: boolean;
  copied?: boolean;
};

export default function BookingView({ model, actions, saving = false, saved = false, copied = false }: Props) {
  return (
    <div className="booking-page">
      <div className="booking-header">
        <div className="booking-title-row">
          <Globe size={20} className="text-foreground" strokeWidth={1.8} />
          <h1 className="booking-title">Booking</h1>
        </div>
        <p className="booking-subtitle">
          Manage how customers can book appointments with {model.workspaceName}.
        </p>
      </div>

      <div className="booking-grid">
        <div className="booking-left">
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
          <SmsConsentCard
            smsConsent={model.smsConsent}
            saving={saving}
            saved={saved}
            onFieldChange={actions.onConsentFieldChange}
            onSave={actions.onSaveConsent}
          />
          <AiProtectionCard
            protectionMode={model.protectionMode}
            protectionOptions={model.protectionOptions}
            suspiciousBookings={model.suspiciousBookings}
            onModeChange={actions.onProtectionModeChange}
          />
          <BookingAdvancedPanel workspaceSlug={model.workspaceSlug} />
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
