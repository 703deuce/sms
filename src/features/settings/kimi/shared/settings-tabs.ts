import { getSettingsTabs, personalSettingsTabs } from "@/lib/settings-tabs";

export function resolveSettingsTabs(personalMode = false) {
  return personalMode ? personalSettingsTabs : getSettingsTabs();
}
