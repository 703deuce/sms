"use client";

import "@/components/appointments/kimi-ui/public-booking/reference.css";
import { BookingShell } from "@/components/appointments/kimi-ui/public-booking/components/BookingShell";
import { BookingLoading, BookingError, BookingNotFound } from "@/components/appointments/kimi-ui/public-booking-service/components/BookingStates";
import { PublicBookingServiceFlowInner } from "@/features/appointments/kimi/public/public-booking-service-flow-inner";
import { PublicBookingPwaRegister } from "@/features/appointments/kimi/public/public-booking-pwa-register";
import {
  usePublicBookingFlow,
} from "@/features/appointments/kimi/public/use-public-booking-flow";
import type { PublicBookingFlowOptions } from "@/features/appointments/kimi/public/types";

export function PublicBookingConnected(props: PublicBookingFlowOptions) {
  const flow = usePublicBookingFlow(props);

  if (flow.loading) {
    return (
      <BookingShell
        workspace={
          flow.workspace
            ? {
                name: flow.workspace.name,
                phone: flow.workspace.businessPhone,
                address: flow.workspace.businessAddress,
              }
            : undefined
        }
      >
        <BookingLoading />
      </BookingShell>
    );
  }

  if (
    flow.error &&
    flow.step === "service" &&
    flow.types.length === 0 &&
    !flow.catalog?.hasClasses
  ) {
    return (
      <BookingShell>
        {flow.error.toLowerCase().includes("disabled") ? (
          <BookingNotFound />
        ) : (
          <BookingError message={flow.error} onRetry={flow.load} />
        )}
      </BookingShell>
    );
  }

  if (!flow.workspace) {
    return (
      <BookingShell>
        {flow.error && /not found|invalid/i.test(flow.error) ? (
          <BookingNotFound />
        ) : (
          <BookingError message={flow.error || "Booking unavailable"} onRetry={flow.load} />
        )}
      </BookingShell>
    );
  }

  return (
    <BookingShell
      workspace={{
        name: flow.workspace.name,
        phone: flow.workspace.businessPhone,
        address: flow.workspace.businessAddress,
      }}
    >
      <PublicBookingPwaRegister />
      <PublicBookingLandingFlowInner flow={flow} slug={props.slug} />
    </BookingShell>
  );
}

function PublicBookingLandingFlowInner({
  flow,
  slug,
}: {
  flow: ReturnType<typeof usePublicBookingFlow>;
  slug: string;
}) {
  return <PublicBookingServiceFlowInner flow={flow} slug={slug} />;
}
