"use client";

import { PublicBookingPwaRegister } from "@/features/appointments/kimi/public/public-booking-pwa-register";
import { PublicBookingOpusView } from "@/features/appointments/kimi/public/public-booking-opus-view";
import { usePublicBookingFlow } from "@/features/appointments/kimi/public/use-public-booking-flow";
import type { PublicBookingFlowOptions } from "@/features/appointments/kimi/public/types";

export function PublicBookingConnected(props: PublicBookingFlowOptions) {
  const flow = usePublicBookingFlow(props);

  return (
    <>
      <PublicBookingPwaRegister />
      <PublicBookingOpusView flow={flow} slug={props.slug} />
    </>
  );
}
