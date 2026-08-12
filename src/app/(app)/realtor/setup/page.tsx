import { SetupHomeView } from "@/components/realtor/setup-home";
import { getActiveWorkspaceId } from "@/lib/auth";
import { loadSetupHomeState } from "@/lib/realtor/setup-home";
import { loadRealtorProductConfig } from "@/lib/realtor/workspace-config";

export default async function RealtorSetupPage() {
  const workspaceId = await getActiveWorkspaceId();
  const config = await loadRealtorProductConfig(workspaceId);
  const setup = await loadSetupHomeState(workspaceId, config);

  return (
    <div className="px-2 py-4 lg:px-4">
      <SetupHomeView
        requiredComplete={setup.requiredComplete}
        requiredTotal={setup.requiredTotal}
        steps={setup.steps}
        readyToGoLive={setup.readyToGoLive}
        live={config.live}
      />
    </div>
  );
}
