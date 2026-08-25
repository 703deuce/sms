import { FaxSettingsForm } from "@/components/fax/fax-settings-form";
import { FaxSubnav } from "@/components/fax/fax-subnav";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { getOrCreateFaxAccount } from "@/lib/fax/fax-usage";

export default async function FaxSettingsPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const account = await getOrCreateFaxAccount(workspaceId);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Fax Settings</h1>
      <div className="mt-6">
        <FaxSubnav />
      </div>
      <div className="mt-6">
        <FaxSettingsForm
          initial={{
            notifyEmail: account.notifyEmail || "",
            notifyOnInbound: account.notifyOnInbound,
            notifyOnFailedOutbound: account.notifyOnFailedOutbound,
            autoAnalyzeInbound: account.autoAnalyzeInbound,
          }}
        />
      </div>
    </div>
  );
}
