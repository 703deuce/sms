"use client";

import { PublicBookingOpusView } from "@/features/appointments/kimi/public/public-booking-opus-view";
import { usePublicBookingFlow } from "@/features/appointments/kimi/public/use-public-booking-flow";
import type { PublicBookingFlowOptions } from "@/features/appointments/kimi/public/types";

export function PublicBookingServiceFlowView(options: PublicBookingFlowOptions) {
  const flow = usePublicBookingFlow(options);
  return <PublicBookingOpusView flow={flow} slug={options.slug} />;
}

export function PublicBookingServiceConnected(
  props: PublicBookingFlowOptions & { initialServiceId?: string },
) {
  return <PublicBookingServiceFlowView {...props} />;
}
