import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadRealtorAmyActivity } from "@/lib/realtor/dashboard";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";

export default async function AgentActivityPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const activity = await loadRealtorAmyActivity(workspaceId);

  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Agent Activity" description="Amy is working — live feed." />
      <Card className="divide-y">
        {activity.map((item) => (
          <div key={item.id} className="p-4">
            <CardTitle className="text-base">{item.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{item.detail}</p>
            <p className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
