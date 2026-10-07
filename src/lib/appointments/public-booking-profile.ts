import { resolveBookingTypeKind } from "@/lib/appointments/booking-type-kind";
import type {
  AppointmentPlatformConfig,
  AppointmentTypeConfig,
  PublicBookingProfile,
} from "@/lib/appointments/types";

export type { PublicBookingProfile };

export function resolvePublicBookingProfile(
  config: Pick<AppointmentPlatformConfig, "publicBookingProfile">,
): PublicBookingProfile {
  return config.publicBookingProfile === "full" ? "full" : "simple";
}

export function isSimplePublicBookingProfile(profile: PublicBookingProfile): boolean {
  return profile === "simple";
}

export function filterTypesForPublicBookingProfile<
  T extends { config?: AppointmentTypeConfig | null; bookingTypeKind?: string },
>(types: T[], profile: PublicBookingProfile): T[] {
  if (profile === "full") return types;
  return types.filter((t) => {
    const kind =
      t.bookingTypeKind ??
      resolveBookingTypeKind(t.config ?? undefined);
    return kind === "MEETING" || kind === "SERVICE";
  });
}
