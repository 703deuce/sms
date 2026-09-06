/** Shared settings subnav — keep every settings surface in sync. */
import { appointmentsSettingsTabs } from "@/lib/products/appointments-settings-tabs";
import { isAppointmentsV1Primary } from "@/lib/workspace/platform-launch";

export const legacySettingsTabs = [
  { label: "Business", href: "/settings/business" },
  { label: "Integrations", href: "/settings/integrations" },
  { label: "Messaging", href: "/settings/messaging" },
  { label: "Email-to-SMS", href: "/settings/email-to-sms" },
  { label: "Users", href: "/settings/users" },
  { label: "Workspaces", href: "/settings/workspaces" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Payments", href: "/settings/payments" },
  { label: "Limits", href: "/settings/limits" },
  { label: "Security", href: "/settings/security" },
  { label: "Branding", href: "/settings/branding" },
  { label: "Data", href: "/settings/data" },
];

/** @deprecated import getSettingsTabs() for product-aware settings navigation */
export const settingsTabs = legacySettingsTabs;

export function getSettingsTabs() {
  return isAppointmentsV1Primary() ? appointmentsSettingsTabs : legacySettingsTabs;
}

/** Personal numbers workspace — billing, usage breakdown, account essentials. */
export const personalSettingsTabs = [
  { label: "Billing", href: "/settings/billing" },
  { label: "Usage", href: "/personal/usage" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Security", href: "/settings/security" },
];
