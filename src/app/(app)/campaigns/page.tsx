import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaigns } from "@/lib/mock/data";
import type { Campaign } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";

const campaignTabs = [
  { label: "All", href: "/campaigns" },
  { label: "Drafts", href: "/campaigns/drafts" },
  { label: "Scheduled", href: "/campaigns/scheduled" },
  { label: "Calendar", href: "/campaigns/calendar" },
  { label: "Completed", href: "/campaigns/completed" },
  { label: "Failed", href: "/campaigns/failed" },
];

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

function CampaignTable({ rows }: { rows: Campaign[] }) {
  return (
    <Table>
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
        {rows.map((c) => (
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
            <TD className="whitespace-nowrap text-muted-foreground">
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
  );
}

export default function CampaignsPage() {
  const scheduledCount = campaigns.filter((c) => c.status === "Scheduled").length;
  const draftCount = campaigns.filter((c) => c.status === "Draft").length;

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Create, schedule, and track outbound SMS campaigns across audiences and segments."
        actions={
          <>
            <Link href="/campaigns/recurring">
              <Button variant="outline">Recurring</Button>
            </Link>
            <Link href="/send">
              <Button>New campaign</Button>
            </Link>
          </>
        }
      />

      <Tabs items={campaignTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total campaigns
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{campaigns.length}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Scheduled
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{scheduledCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Drafts
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{draftCount}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>All campaigns</CardTitle>
        <div className="mt-4">
          <CampaignTable rows={campaigns} />
        </div>
      </Card>
    </div>
  );
}
