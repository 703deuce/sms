import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadRealtorDashboard } from "@/lib/realtor/dashboard";
import { requireRealtorOnboardingComplete } from "@/lib/realtor/layout-guards";
import { formatPhone } from "@/lib/utils";
import Link from "next/link";

export default async function RealtorDashboardPage() {
  const { workspaceId } = await requireRealtorOnboardingComplete();
  const data = await loadRealtorDashboard(workspaceId);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={data.setupMode ? "Amy is ready" : "Dashboard"}
        description={
          data.setupMode
            ? "Your Real Estate workspace is configured. Amy is waiting for your next lead."
            : "What happened while you were gone?"
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Amy</p>
            <p className="font-semibold">
              Front Desk — {data.amy.frontDeskActive ? "Active" : "Off"}
            </p>
            <p className="text-sm text-muted-foreground">
              Speed-to-Lead — {data.amy.speedToLeadActive ? "Active" : "Off"}
            </p>
          </div>
          {data.amy.phoneE164 ? (
            <p className="text-sm">Number: {formatPhone(data.amy.phoneE164)}</p>
          ) : null}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-5">
        {[
          ["New Leads", data.metrics.newLeads],
          ["Worked", data.metrics.worked],
          ["Contacted", data.metrics.contacted],
          ["Qualified", data.metrics.qualified],
          ["Appointments", data.metrics.appointments],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>

      {data.needsAttention.length > 0 ? (
        <Card className="p-4">
          <CardTitle className="mb-3">Needs Your Attention ({data.metrics.needYou})</CardTitle>
          <ul className="space-y-3">
            {data.needsAttention.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 border-b pb-3 last:border-0">
                <div>
                  <p className="font-medium">{item.leadName}</p>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                  <p className="text-sm">{item.detail}</p>
                </div>
                <Button size="sm">
                  <Link href={item.href}>View</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-4">
        <CardTitle className="mb-3">Amy Working Now</CardTitle>
        {data.amyActivity.length ? (
          <ul className="space-y-2 text-sm">
            {data.amyActivity.map((item) => (
              <li key={item.id} className="flex justify-between gap-4 border-b py-2 last:border-0">
                <span className="font-medium">{item.title}</span>
                <span className="text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Amy is ready. Waiting for your next lead.</p>
        )}
      </Card>

      <div className="flex gap-3">
        <Button>
          <Link href="/realtor/test">Try Amy — Add Test Lead</Link>
        </Button>
        <Button variant="outline">
          <Link href="/realtor/leads">View Leads</Link>
        </Button>
      </div>
    </div>
  );
}
