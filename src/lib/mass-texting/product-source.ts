import type { MassTextConversationProductSource } from "@/lib/mass-texting/constants";

export type PhoneProductRoles = {
  mctb: boolean;
  massText: boolean;
};

export function readPhoneProductRoles(settingsJson: unknown): PhoneProductRoles {
  const s =
    settingsJson && typeof settingsJson === "object"
      ? (settingsJson as Record<string, unknown>)
      : {};
  const mctbRole = String(s.mctbRole || "").toLowerCase();
  const massTextRole = String(s.massTextRole || s.mass_text_role || "").toLowerCase();
  return {
    mctb: Boolean(mctbRole && mctbRole !== "none"),
    massText: massTextRole === "primary" || massTextRole === "mass_text" || massTextRole === "marketing",
  };
}

export function inferInboundProductSource(input: {
  phoneSettingsJson?: unknown;
  campaignId?: string | null;
  campaignProductSource?: MassTextConversationProductSource | null;
  explicit?: MassTextConversationProductSource | null;
}): MassTextConversationProductSource {
  if (input.explicit) return input.explicit;
  const roles = readPhoneProductRoles(input.phoneSettingsJson);
  if (roles.mctb) return "mctb";
  if (roles.massText) return "mass_text";
  if (input.campaignProductSource === "mass_text") return "mass_text";
  if (input.campaignProductSource === "mctb") return "mctb";
  return "manual";
}

export function prismaProductSourceToApp(
  value: string | null | undefined,
): MassTextConversationProductSource | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "mctb") return "mctb";
  if (v === "mass_text") return "mass_text";
  if (v === "manual") return "manual";
  if (v === "automation") return "automation";
  if (v === "appointment_reminders") return "manual";
  return null;
}

export function appProductSourceToPrisma(
  value: MassTextConversationProductSource,
): "MCTB" | "MASS_TEXT" | "MANUAL" | "AUTOMATION" | "APPOINTMENT_REMINDERS" {
  switch (value) {
    case "mctb":
      return "MCTB";
    case "mass_text":
      return "MASS_TEXT";
    case "automation":
      return "AUTOMATION";
    default:
      return "MANUAL";
  }
}

export function productSourceLabel(source: MassTextConversationProductSource | null): string {
  switch (source) {
    case "mctb":
      return "Missed Call Text Back";
    case "mass_text":
      return "Mass Texting";
    case "automation":
      return "Automation";
    case "manual":
      return "Manual";
    default:
      return "All";
  }
}
