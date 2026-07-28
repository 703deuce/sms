import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaigns } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import { FileEdit } from "lucide-react";
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

export default function CampaignDraftsPage() {
  const drafts = campaigns.filter((c) => c.status === "Draft");

  return (
    <div>
      <PageHeader
        title="Draft campaigns"
        description="Campaigns saved but not yet scheduled or sent. Finish audience, message, and compliance before launch."
        actions={
          <Link href="/send">
            <Button>New campaign</Button>
          </Link>
        }
      />

      <Tabs items={campaignTabs} />

      {drafts.length === 0 ? (
        <EmptyState
          icon={<FileEdit className="h-8 w-8" />}
          title="No drafts yet"
          description="Start a new campaign in the Send wizard and save it as a draft to continue later."
          actionLabel="Create campaign"
          actionHref="/send"
        />
      ) : (
        <Card>
          <CardTitle>{drafts.length} draft{drafts.length === 1 ? "" : "s"}</CardTitle>
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
              {drafts.map((c) => (
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
        </Card>
      )}
    </div>
  );
}
