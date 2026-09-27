import { ApiKeysPanel } from "@/components/integrations/api-keys-panel";
import { ApiKeysOpusPanel } from "@/newui-transplant/connected/integrations/api-keys-opus-panel";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { loadApiKeys, requireWorkspaceContext } from "@/lib/workspace-data";
import { isNewUiStage2Enabled } from "@/lib/newui-transplant/stage2-enabled";
import { Plus } from "lucide-react";

const integrationTabs = [
  { label: "Directory", href: "/integrations" },
  { label: "API", href: "/integrations/api" },
  { label: "Webhooks", href: "/integrations/webhooks" },
  { label: "Developer logs", href: "/integrations/logs" },
];

export default async function IntegrationsApiPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const rows = await loadApiKeys(workspaceId);

  const initialKeys = rows.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() || null,
  }));

  const opus = isNewUiStage2Enabled();

  if (opus) {
    return <ApiKeysOpusPanel initialKeys={initialKeys} />;
  }

  return (
    <div>
      <PageHeader
        title="API keys"
        description="Create and manage API keys for programmatic access to contacts, campaigns, and messages."
        actions={
          <Button disabled>
            <Plus className="h-4 w-4" />
            Create key
          </Button>
        }
      />

      <Tabs items={integrationTabs} />

      <ApiKeysPanel initialKeys={initialKeys} />
    </div>
  );
}
