import type { VoiceV2DayOfWeek } from "@/lib/voice-receptionist-wizard/operating-maturity/types";

export type TransferDestinationAvailabilityMode = "ALWAYS" | "SCHEDULED";

export type TransferEligibilityReason =
  | "ALWAYS_AVAILABLE"
  | "WITHIN_SCHEDULE"
  | "OUTSIDE_SCHEDULE"
  | "TEMPORARILY_UNAVAILABLE"
  | "DISABLED";

export type TransferAvailabilityTimeWindow = {
  /** HH:mm 24h local wall time */
  start: string;
  /** HH:mm 24h; end exclusive. Overnight when end <= start (spans into next calendar day). */
  end: string;
};

export type TransferAvailabilityDayConfig = {
  enabled: boolean;
  /** Whole local calendar day when true (ignores windows). */
  allDay?: boolean;
  windows: TransferAvailabilityTimeWindow[];
};

export type TransferDestinationAvailability = {
  mode: TransferDestinationAvailabilityMode;
  /** IANA timezone, e.g. America/New_York */
  timezone: string;
  temporarilyUnavailable?: boolean;
  weekly: Partial<Record<VoiceV2DayOfWeek, TransferAvailabilityDayConfig>>;
};

export type TransferDestinationEligibilityResult = {
  eligible: boolean;
  reason: TransferEligibilityReason;
};

export const TRANSFER_WEEKDAYS: VoiceV2DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export function defaultTransferDestinationAvailability(
  timezone: string,
): TransferDestinationAvailability {
  return {
    mode: "ALWAYS",
    timezone,
    temporarilyUnavailable: false,
    weekly: {},
  };
}
