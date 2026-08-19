import { MyNumbersView } from "@/components/numbers/my-numbers-view";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import { loadMyNumbersFromTriggers } from "@/lib/numbers/load-my-numbers";
import { isNumbersPlatformOnlyLaunch } from "@/lib/workspace/platform-launch";
import { redirect } from "next/navigation";

export default async function MyNumbersPage() {
  if (isNumbersPlatformOnlyLaunch()) {
    redirect("/personal/vault");
  }
  const session = await getSession();
  if (!session) redirect("/login");
  const workspaceId = await getActiveWorkspaceId();
  const { rows, summary } = await loadMyNumbersFromTriggers(workspaceId);
  return <MyNumbersView rows={rows} summary={summary} />;
}
