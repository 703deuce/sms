import type { PhoneNumber } from "@/lib/types";
import { derivePersonalDisplayState } from "@/lib/numbers/personal-call-settings";
import type {
  PersonalAcquisitionType,
  PersonalServiceState,
} from "@/lib/workspace/types";

export function readPersonalSettings(number: PhoneNumber): Record<string, unknown> {
  return number.settingsJson && typeof number.settingsJson === "object"
    ? number.settingsJson
    : {};
}

export function derivePersonalServiceState(number: PhoneNumber): PersonalServiceState {
  const settings = readPersonalSettings(number);
  const explicit = settings.personalServiceState as string | undefined;
  if (
    explicit === "PARKED" ||
    explicit === "PARKED_VOICEMAIL" ||
    explicit === "FORWARDING" ||
    explicit === "VOICEMAIL" ||
    explicit === "PORTING_IN" ||
    explicit === "PORTING_OUT" ||
    explicit === "PORT_AWAY_WINDOW"
  ) {
    return explicit as PersonalServiceState;
  }

  const portStatus = settings.portStatus as string | undefined;
  if (portStatus === "porting_in" || portStatus === "PORTING_IN") return "PORTING_IN";
  if (portStatus === "porting_out" || portStatus === "PORTING_OUT") return "PORTING_OUT";

  const portAwayExpires = settings.portAwayWindowExpiresAt as string | undefined;
  if (portAwayExpires && new Date(portAwayExpires).getTime() > Date.now()) {
    return "PORT_AWAY_WINDOW";
  }

  const derived = derivePersonalDisplayState(number);
  if (derived === "PARKED_VOICEMAIL") return "PARKED_VOICEMAIL";
  if (derived === "PARKED") return "PARKED";
  if (derived === "FORWARDING") return "FORWARDING";
  if (derived === "VOICEMAIL") return "VOICEMAIL";
  if (derived === "ANNOUNCEMENT") return "VOICEMAIL"; // announcement-only uses VOICEMAIL bucket for billing
  if (derived === "SMART_ROUTING") return "ACTIVE";

  return "ACTIVE";
}

export function deriveAcquisitionType(number: PhoneNumber): PersonalAcquisitionType {
  const settings = readPersonalSettings(number);
  const raw = settings.acquisitionType as string | undefined;
  if (raw === "PORTED_IN" || raw === "PREMIUM_PURCHASE" || raw === "PURCHASED") {
    return raw;
  }
  if (settings.premiumPurchase === true) return "PREMIUM_PURCHASE";
  if (settings.portedIn === true) return "PORTED_IN";
  return "PURCHASED";
}

export function personalServiceLabel(
  state: PersonalServiceState,
  number?: PhoneNumber,
): string {
  if (number && derivePersonalDisplayState(number) === "ANNOUNCEMENT") {
    return "Announcement only";
  }
  switch (state) {
    case "PARKED":
      return "Parked in Number Vault";
    case "PARKED_VOICEMAIL":
      return "Vaulted — voicemail on";
    case "FORWARDING":
      return "Call forwarding";
    case "VOICEMAIL":
      return "Voicemail";
    case "PORTING_IN":
      return "Port in progress";
    case "PORTING_OUT":
      return "Port away in progress";
    case "PORT_AWAY_WINDOW":
      return "Ready to transfer";
    default:
      return "Active";
  }
}
