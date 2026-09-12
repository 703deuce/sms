"use client";

import { PlatformIntegrationCards } from "@/components/integrations/platform-integration-cards";
import { ConnectableProvidersGrid } from "@/components/integrations/connectable-providers-grid";
import { IntegrationsDirectory } from "./integrations-directory";

type Props = {
  connectedApi: boolean;
  connectedWebhooks: boolean;
  endpointsCount: number;
  focusProvider?: string | null;
};

export function IntegrationsHomeClient({
  connectedApi,
  connectedWebhooks,
  endpointsCount,
  focusProvider,
}: Props) {
  return (
    <div className="space-y-6">
      <PlatformIntegrationCards focusProvider={focusProvider} />
      <ConnectableProvidersGrid
        title="Connect your apps"
        description="CRM, scheduling, commerce, and marketing integrations."
      />
      <IntegrationsDirectory
        connectedApi={connectedApi}
        connectedWebhooks={connectedWebhooks}
        endpointsCount={endpointsCount}
      />
    </div>
  );
}
