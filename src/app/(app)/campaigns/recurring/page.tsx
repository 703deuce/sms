import { RecurringCampaignForm } from "@/components/campaigns/recurring-campaign-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { campaignTabs } from "@/lib/campaign-tabs";
import { formatNumber } from "@/lib/utils";
import { loadRecurringCampaigns, requireWorkspaceContext } from "@/lib/workspace-data";
import { Repeat } from "lucide-react";
import Link from "next/link";

function formatDateTime(at: string | null) {
  if (!at) return "—";
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function recurrenceNextRun(configJson: unknown): string | null {
  if (!configJson || typeof configJson !== "object") return null;
  const rec = (configJson as Record<string, unknown>).recurrence;
  if (!rec || typeof rec !== "object") return null;
  const next = (rec as Record<string, unknown>).nextRunAt;
  return typeof next === "string" ? next : null;
}

export default async function CampaignRecurringPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const { isMassTextingWorkspace } = await import("@/lib/mass-texting/access");
  const { MASS_TEXT_RECURRING_PRODUCTION_ENABLED } = await import(
    "@/lib/mass-texting/constants"
  );
  const massTexting = await isMassTextingWorkspace(workspaceId);
  const recurringEnabled = !massTexting || MASS_TEXT_RECURRING_PRODUCTION_ENABLED;
  const recurringCampaigns = await loadRecurringCampaigns(workspaceId);
  const activeCount = recurringCampaigns.filter((c) => c.status === "Active").length;

  return (
    <div>
      <PageHeader
        title="Recurring campaigns"
        description={
          recurringEnabled
            ? "Automated sends that repeat on a schedule. Each run uses current audience membership and compliance settings."
            : "Recurring Mass Texting campaigns are not enabled in V1. Use Send now or a one-time schedule instead."
        }
        actions={
          <>
            <Link href="/campaigns">
              <Button variant="outline">All campaigns</Button>
            </Link>
            {recurringEnabled ? (
              <Link href="/send">
                <Button>Create recurring</Button>
              </Link>
            ) : (
              <Link href="/campaigns/new/promotion">
                <Button>Create campaign</Button>
              </Link>
            )}
          </>
        }
      />

      <Tabs items={campaignTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recurring flows
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {recurringCampaigns.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{activeCount}</p>
        </Card>
        <Card>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Messages sent (lifetime)
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {formatNumber(recurringCampaigns.reduce((sum, c) => sum + c.sent, 0))}
          </p>
        </Card>
      </div>

      {recurringEnabled ? (
        <RecurringCampaignForm />
      ) : (
        <Card className="mb-6">
          <CardTitle>Not available for Mass Texting V1</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Recurring ticks would skip credit reservation and A2P launch. Create a one-time
            campaign from Campaigns instead.
          </p>
        </Card>
      )}

      {recurringCampaigns.length === 0 ? (
        <EmptyState
          icon={<Repeat className="h-8 w-8" />}
          title="No recurring campaigns"
          description="Recurring and reminder campaigns will appear here when you create appointment reminders or scheduled sequences."
          actionLabel={recurringEnabled ? "Create campaign" : "Create one-time campaign"}
          actionHref={recurringEnabled ? "/send" : "/campaigns/new/promotion"}
        />
      ) : (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" />
            <CardTitle>Recurring schedule</CardTitle>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Type</TH>
                <TH>Audience</TH>
                <TH>Next run</TH>
                <TH>Status</TH>
                <TH>Total sent</TH>
                <TH>Created by</TH>
              </TR>
            </THead>
            <TBody>
              {recurringCampaigns.map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium">
                    <Link href={`/campaigns/${c.id}`} className="text-primary hover:underline">
                      {c.name}
                    </Link>
                  </TD>
                  <TD className="text-muted-foreground">{c.type}</TD>
                  <TD className="text-muted-foreground">{c.audience}</TD>
                  <TD className="whitespace-nowrap font-medium">
                    {formatDateTime(recurrenceNextRun(c.configJson) || c.scheduledAt)}
                  </TD>
                  <TD>
                    <StatusChip status={c.status} />
                  </TD>
                  <TD>{formatNumber(c.sent)}</TD>
                  <TD className="text-muted-foreground">{c.createdBy || "—"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      <Card className="mt-6">
        <CardTitle>How recurring campaigns work</CardTitle>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>Audience is re-evaluated before each run — new subscribers are included automatically.</li>
          <li>Quiet hours and A2P limits apply to every scheduled occurrence.</li>
          <li>Paused flows retain their schedule but skip runs until reactivated.</li>
          <li>Each run creates a child campaign record visible under Completed or Failed.</li>
        </ul>
      </Card>
    </div>
  );
}
