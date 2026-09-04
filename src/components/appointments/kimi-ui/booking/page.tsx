"use client";

import React from "react";
import { Globe } from "lucide-react";
import PublicBookingCard from "./components/PublicBookingCard";
import BusinessInfoCard from "./components/BusinessInfoCard";
import SmsConsentCard from "./components/SmsConsentCard";
import AiProtectionCard from "./components/AiProtectionCard";
import LivePreview from "./components/LivePreview";
import "./reference.css";

export default function BookingPage() {
  return (
    <div className="booking-page">
      <div className="booking-header">
        <div className="booking-title-row">
          <Globe size={22} className="text-foreground" strokeWidth={1.8} />
          <h1 className="booking-title">Booking</h1>
        </div>
        <p className="booking-subtitle">
          Manage how customers can book appointments with your business.
        </p>
      </div>

      <div className="booking-grid">
        <div className="booking-left">
          <PublicBookingCard />
          <BusinessInfoCard />
          <SmsConsentCard />
          <AiProtectionCard />
        </div>
        <div className="booking-right">
          <LivePreview />
        </div>
      </div>
    </div>
  );
}
