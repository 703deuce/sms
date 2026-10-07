"use client";

import { PublicBookingServiceFlowInner } from "@/features/appointments/kimi/public/public-booking-service-flow-inner";
import type { PublicBookingFlow } from "@/features/appointments/kimi/public/use-public-booking-flow";
import {
  OpusPublicBookingError,
  OpusPublicBookingLoading,
  OpusPublicBookingNotFound,
} from "@/newui-transplant/components/public-booking/opus-public-booking-states";

export function PublicBookingOpusView({
  flow,
  slug,
  embed,
}: {
  flow: PublicBookingFlow;
  slug: string;
  embed?: boolean;
}) {
  if (flow.loading) {
    return (
      <div className="min-h-screen bg-muted/30">
        <OpusPublicBookingLoading />
      </div>
    );
  }
  if (flow.error && flow.step === "service" && flow.types.length === 0) {
    if (flow.error.toLowerCase().includes("disabled")) return <OpusPublicBookingNotFound />;
    return <OpusPublicBookingError message={flow.error} onRetry={flow.load} />;
  }
  if (!flow.workspace) {
    if (flow.error && /not found|invalid/i.test(flow.error)) return <OpusPublicBookingNotFound />;
    return (
      <OpusPublicBookingError message={flow.error || "Booking unavailable"} onRetry={flow.load} />
    );
  }

  return <PublicBookingServiceFlowInner flow={flow} slug={slug} embed={embed} />;
}
