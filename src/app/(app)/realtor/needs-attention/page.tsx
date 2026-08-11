import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadRealtorNeedsAttention } from "@/lib/realtor/dashboard";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import Link from "next/link";

export default async function RealtorNeedsAttentionPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const items = await loadRealtorNeedsAttention(workspaceId);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Needs Attention"
        description="Amy handles everything she can. This is what you handle."
      />
      <Card className="divide-y">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 p-4">
              <div>
                <CardTitle className="text-base">{item.leadName}</CardTitle>
                <p className="text-sm font-medium text-primary">{item.reason}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
              <Link href={item.href} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs text-primary-foreground">
                Open
              </Link>
            </div>
          ))
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Nothing needs your attention right now.</p>
        )}
      </Card>
    </div>
  );
}
