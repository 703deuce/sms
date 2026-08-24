export type DestinationAvailabilityStatus = "available" | "unavailable";

export type DestinationAvailabilityFields = {
  active: boolean;
  availabilityStatus?: string | null;
  unavailableUntil?: Date | string | null;
  onBusinessCall?: boolean | null;
};

/** Whether Smart Routing should currently route calls to this destination. */
export function isDestinationAvailable(dest: DestinationAvailabilityFields): boolean {
  if (!dest.active) return false;
  if (dest.onBusinessCall) return false;
  const status = dest.availabilityStatus ?? "available";
  if (status !== "unavailable") return true;
  if (!dest.unavailableUntil) return false;
  const until = dest.unavailableUntil instanceof Date
    ? dest.unavailableUntil
    : new Date(dest.unavailableUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until <= new Date();
}

export function destinationAvailabilityLabel(dest: DestinationAvailabilityFields & {
  phoneNumber?: string | null;
}): string {
  if (!dest.active) return "Disabled";
  if (!dest.phoneNumber?.trim()) return "Invalid — no phone";
  if (dest.onBusinessCall) return "On a call";
  if (!isDestinationAvailable(dest)) {
    if (dest.unavailableUntil) {
      const until = dest.unavailableUntil instanceof Date
        ? dest.unavailableUntil
        : new Date(dest.unavailableUntil);
      if (until > new Date()) return "Temporarily unavailable";
    }
    return "Unavailable";
  }
  return "Available";
}

export function pauseDurationUntil(
  preset: "manual" | "1h" | "tomorrow" | "custom",
  customUntil?: string,
): Date | null {
  if (preset === "manual") return null;
  if (preset === "1h") return new Date(Date.now() + 60 * 60 * 1000);
  if (preset === "custom" && customUntil) {
    const d = new Date(customUntil);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  return tomorrow;
}
