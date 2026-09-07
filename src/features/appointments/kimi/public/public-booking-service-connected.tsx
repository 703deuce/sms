"use client";

import "@/components/appointments/kimi-ui/public-booking-service/reference.css";
import { BookingLoading, BookingError, BookingNotFound } from "@/components/appointments/kimi-ui/public-booking-service/components/BookingStates";
import { PublicBookingServiceFlowInner } from "@/features/appointments/kimi/public/public-booking-service-flow-inner";
import { usePublicBookingFlow } from "@/features/appointments/kimi/public/use-public-booking-flow";
import type { PublicBookingFlowOptions } from "@/features/appointments/kimi/public/types";

export function PublicBookingServiceFlowView(options: PublicBookingFlowOptions) {
  const flow = usePublicBookingFlow(options);

  if (flow.loading) return <BookingLoading />;
  if (flow.error && flow.step === "service" && flow.types.length === 0) {
    if (flow.error.toLowerCase().includes("disabled")) return <BookingNotFound />;
    return <BookingError message={flow.error} onRetry={flow.load} />;
  }
  if (!flow.workspace) return <BookingError message={flow.error || "Booking unavailable"} onRetry={flow.load} />;

  return <PublicBookingServiceFlowInner flow={flow} slug={options.slug} />;
}

export function PublicBookingServiceConnected(
  props: PublicBookingFlowOptions & { initialServiceId?: string },
) {
  return <PublicBookingServiceFlowView {...props} />;
}
