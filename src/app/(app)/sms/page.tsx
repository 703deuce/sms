import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { loadMassTextOverviewMetrics } from "@/lib/mass-texting/overview-metrics";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { formatPhone } from "@/lib/utils";
import { Megaphone, Upload, Users } from "lucide-react";

export default async function MassTextingOverviewPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const metrics = await loadMassTextOverviewMetrics(workspaceId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Mass Texting</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Upload your list, create a campaign, send it, see what happened.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/campaigns/new/promotional">
            <Button className="h-9 rounded-[10px]">
              <Megaphone className="h-4 w-4" />
              New Campaign
            </Button>
          </Link>
          <Link href="/contacts/imports">
            <Button variant="outline" className="h-9 rounded-[10px]">
              <Upload className="h-4 w-4" />
              Import Contacts
            </Button>
          </Link>
          <Link href="/contacts/lists">
            <Button variant="outline" className="h-9 rounded-[10px]">
              <Users className="h-4 w-4" />
              Create List
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Sent this month", value: metrics.messagesSentMonth.toLocaleString() },
          { label: "Delivered", value: metrics.delivered.toLocaleString() },
          { label: "Delivery rate", value: `${metrics.deliveryRate}%` },
          { label: "Replies", value: metrics.replies.toLocaleString() },
          { label: "Reply rate", value: `${metrics.replyRate}%` },
          { label: "Opt-outs", value: metrics.optOuts.toLocaleString() },
          {
            label: "Segments remaining",
            value: metrics.creditsRemainingCents > 0
              ? Math.round(metrics.creditsRemainingCents / 100).toLocaleString()
              : "0",
          },
          {
            label: "Sending number",
            value: metrics.sendingNumber ? formatPhone(metrics.sendingNumber) : "Not assigned",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[14px] border border-border bg-card p-4 shadow-sm"
          >
            <p className="text-[12px] font-medium text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-[22px] font-semibold tracking-tight">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[14px] border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">A2P status</h2>
            <StatusChip status={metrics.a2pStatus === "approved" ? "Approved" : "Pending"} />
          </div>
          <p className="text-[13px] text-muted-foreground">
            Mass Text marketing uses a separate A2P registration from Missed Call Text Back.
          </p>
          <Link href="/sms/compliance" className="mt-3 inline-block text-[13px] font-medium text-primary">
            View compliance setup
          </Link>
        </section>

        <section className="rounded-[14px] border border-border bg-card p-4">
          <h2 className="mb-3 text-[15px] font-semibold">Upcoming scheduled</h2>
          {metrics.upcomingScheduled.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No scheduled campaigns yet.</p>
          ) : (
            <ul className="space-y-2">
              {metrics.upcomingScheduled.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-[13px]">
                  <Link href={`/campaigns/${c.id}`} className="font-medium hover:text-primary">
                    {c.name}
                  </Link>
                  <span className="text-muted-foreground">
                    {new Date(c.scheduledAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-[14px] border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Recent campaigns</h2>
          <Link href="/campaigns" className="text-[13px] font-medium text-primary">
            View all
          </Link>
        </div>
        {metrics.recentCampaigns.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[14px] font-medium">No campaigns yet</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Create your first campaign to start sending.
            </p>
            <Link href="/campaigns/new/promotional" className="mt-4 inline-block">
              <Button>Create your first campaign</Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Campaign</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Sent</th>
                  <th className="py-2 pr-3 font-medium">Delivered</th>
                  <th className="py-2 pr-3 font-medium">Replies</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentCampaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <Link href={`/campaigns/${c.id}`} className="font-medium hover:text-primary">
                        {c.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{c.status}</td>
                    <td className="py-2 pr-3">{c.sent}</td>
                    <td className="py-2 pr-3">{c.delivered}</td>
                    <td className="py-2 pr-3">{c.replies}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
