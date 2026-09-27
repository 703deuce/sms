import { redirect } from "next/navigation";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import SettingsUsersPage from "../users/page";

/** Opus nav uses /settings/team; legacy route remains /settings/users. */
export default async function SettingsTeamPage() {
  if (!isNewUiStage2Enabled()) {
    redirect("/settings/users");
  }
  return <SettingsUsersPage />;
}
