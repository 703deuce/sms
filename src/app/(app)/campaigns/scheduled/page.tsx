import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { getActiveWorkspaceId } from "@/lib/auth";
import type { Campaign } from "@/lib/types";
import { loadCampaigns } from "@/lib/workspace-data";
import { formatNumber } from "@/lib/utils";
import { CalendarClock } from "lucide-react";
import Link from "next/link";
import { campaignTabs } from "@/lib/campaign-tabs";

function formatScheduled(at: string | null) {
  if (!at) return "—";
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function CampaignScheduledPage() {
  const workspaceId = await getActiveWorkspaceId();

  if (!workspaceId) {
    return (
      <div>
        <PageHeader title="Scheduled campaigns" description="Upcoming sends queued for delivery." />
        <EmptyState title="No workspace selected" description="Select or create a workspace to view campaigns." />
      </div>
    );
  }

  const scheduled: Campaign[] = (await loadCampaigns(workspaceId, "SCHEDULED")).sort((a: Campaign, b: Campaign) => {
    const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
    const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
    return aTime - bTime;
  });

  return (
    <div>
      <PageHeader
        title="Scheduled campaigns"
        description="Upcoming sends queued for delivery. Review audience estimates and quiet-hour settings before launch."
        actions={
          <>
            <Link href="/campaigns/calendar">
              <Button variant="outline">Calendar view</Button>
            </Link>
            <Link href="/send">
              <Button>Schedule campaign</Button>
            </Link>
          </>
        }
      />

      <Tabs items={campaignTabs} />

      {scheduled.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-8 w-8" />}
          title="Nothing scheduled"
          description="Schedule a campaign to see it here. Sends respect account quiet hours and A2P limits."
          actionLabel="Schedule campaign"
          actionHref="/send"
        />
      ) : (
        <Card>
          <CardTitle>{scheduled.length} scheduled</CardTitle>
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Audience</TH>
                <TH>Scheduled</TH>
                <TH>Status</TH>
                <TH>Sent</TH>
                <TH>Delivered</TH>
                <TH>Replies</TH>
                <TH>Clicks</TH>
                <TH>Opt-outs</TH>
                <TH>Created by</TH>
              </TR>
            </THead>
            <TBody>
              {scheduled.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{c.type}</TD>
                  <TD className="text-muted-foreground">{c.audience}</TD>
                  <TD className="whitespace-nowrap font-medium">
                    {formatScheduled(c.scheduledAt)}
                  </TD>
                  <TD>
                    <StatusChip status={c.status} />
                  </TD>
                  <TD>{formatNumber(c.sent)}</TD>
                  <TD>{formatNumber(c.delivered)}</TD>
                  <TD>{formatNumber(c.replies)}</TD>
                  <TD>{formatNumber(c.clicks)}</TD>
                  <TD>{formatNumber(c.optOuts)}</TD>
                  <TD className="text-muted-foreground">{c.createdBy}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
