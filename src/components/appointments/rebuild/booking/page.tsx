"use client";

import { Globe } from "lucide-react";
import PublicBookingCard from "./components/PublicBookingCard";
import BusinessInfoCard from "./components/BusinessInfoCard";
import SmsConsentCard from "./components/SmsConsentCard";
import AiProtectionCard from "./components/AiProtectionCard";
import ReviewBookingsCard from "./components/ReviewBookingsCard";
import LivePreview from "./components/LivePreview";
import "./reference.css";

export default function BookingPage() {
  return (
    <div className="booking-page min-h-full bg-[#f7f7fa] p-6">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-[20px] font-semibold text-foreground">
          <Globe className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
          Booking
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Manage how customers can book appointments with your business.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        {/* Left column — settings cards */}
        <div className="space-y-5">
          <PublicBookingCard />
          <BusinessInfoCard />
          <SmsConsentCard />
          <AiProtectionCard />
          <ReviewBookingsCard />
        </div>

        {/* Right column — live preview */}
        <div className="xl:sticky xl:top-6 self-start">
          <LivePreview />
        </div>
      </div>
    </div>
  );
}
