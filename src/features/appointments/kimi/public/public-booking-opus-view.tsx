"use client";

import { BookingShell } from "@/components/appointments/kimi-ui/public-booking/components/BookingShell";
import { PublicBookingServiceFlowInner } from "@/features/appointments/kimi/public/public-booking-service-flow-inner";
import type { PublicBookingFlow } from "@/features/appointments/kimi/public/use-public-booking-flow";
import {
  OpusPublicBookingError,
  OpusPublicBookingLoading,
  OpusPublicBookingNotFound,
} from "@/newui-transplant/components/public-booking/opus-public-booking-states";

function shellWorkspace(flow: PublicBookingFlow) {
  const ws = flow.workspace;
  if (!ws) return undefined;
  return {
    name: ws.name,
    phone: ws.businessPhone,
    address: ws.businessAddress,
    logoInitial: ws.name.charAt(0),
  };
}

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
      <BookingShell workspace={shellWorkspace(flow)}>
        <OpusPublicBookingLoading />
      </BookingShell>
    );
  }
  if (flow.error && flow.step === "service" && flow.types.length === 0) {
    if (flow.error.toLowerCase().includes("disabled")) {
      return (
        <BookingShell>
          <OpusPublicBookingNotFound />
        </BookingShell>
      );
    }
    return (
      <BookingShell>
        <OpusPublicBookingError message={flow.error} onRetry={flow.load} />
      </BookingShell>
    );
  }
  if (!flow.workspace) {
    if (flow.error && /not found|invalid/i.test(flow.error)) {
      return (
        <BookingShell>
          <OpusPublicBookingNotFound />
        </BookingShell>
      );
    }
    return (
      <BookingShell>
        <OpusPublicBookingError message={flow.error || "Booking unavailable"} onRetry={flow.load} />
      </BookingShell>
    );
  }

  if (embed) {
    return <PublicBookingServiceFlowInner flow={flow} slug={slug} embed />;
  }

  return (
    <BookingShell workspace={shellWorkspace(flow)}>
      <PublicBookingServiceFlowInner flow={flow} slug={slug} embed />
    </BookingShell>
  );
}
