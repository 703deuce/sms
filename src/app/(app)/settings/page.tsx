import { redirect } from "next/navigation";

/**
 * Settings index — redirects to the business profile section.
 * Billing intentionally lives as its own top-level sidebar item,
 * not under Settings, so we land on the business profile tab.
 */
export default function SettingsIndexPage() {
  redirect("/settings/business");
}
