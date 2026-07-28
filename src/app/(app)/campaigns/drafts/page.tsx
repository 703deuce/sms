import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaignTabs } from "@/lib/campaign-tabs";
import { campaigns } from "@/lib/mock/data";
import { formatNumber } from "@/lib/utils";
import { FileEdit, Plus } from "lucide-react";
import Link from "next/link";

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
    <div className="text-[13px]">
      <SectionHeader
        title="Draft campaigns"
        description="Campaigns saved but not yet scheduled or sent. Finish audience, message, and compliance before launch."
        actions={
          <Link href="/send">
            <Button className="rounded-[10px]">
              <Plus className="h-4 w-4" />
              New campaign
            </Button>
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
        <Card className="rounded-[12px] p-4">
          <h2 className="mb-4 text-[14px] font-bold text-foreground">
            {drafts.length} draft{drafts.length === 1 ? "" : "s"}
          </h2>
          <Table className="text-[13px]">
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
                      className="font-semibold text-primary hover:underline"
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
                  <TD className="tabular-nums">{formatNumber(c.sent)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.delivered)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.replies)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.clicks)}</TD>
                  <TD className="tabular-nums">{formatNumber(c.optOuts)}</TD>
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
