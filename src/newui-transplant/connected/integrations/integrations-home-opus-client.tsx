"use client";

import { ConnectableProvidersOpus } from "@/newui-transplant/connected/integrations/connectable-providers-opus";
import { IntegrationsDirectoryOpus } from "@/newui-transplant/connected/integrations/integrations-directory-opus";
import { PlatformIntegrationsOpus } from "@/newui-transplant/connected/integrations/platform-integrations-opus";

type Props = {
  connectedApi: boolean;
  connectedWebhooks: boolean;
  endpointsCount: number;
  focusProvider?: string | null;
};

export function IntegrationsHomeOpusClient({
  connectedApi,
  connectedWebhooks,
  endpointsCount,
  focusProvider,
}: Props) {
  return (
    <div className="space-y-6">
      <PlatformIntegrationsOpus focusProvider={focusProvider} />
      <ConnectableProvidersOpus />
      <IntegrationsDirectoryOpus
        connectedApi={connectedApi}
        connectedWebhooks={connectedWebhooks}
        endpointsCount={endpointsCount}
      />
    </div>
  );
}
