import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import {
  requireWorkspaceContext,
  loadSuppressions,
} from "@/lib/workspace-data";
import { formatNumber, formatPhone } from "@/lib/utils";

const complianceTabs = [
  { label: "Overview", href: "/compliance" },
  { label: "Business", href: "/compliance/business" },
  { label: "Brand", href: "/compliance/brand" },
  { label: "Campaign", href: "/compliance/campaign" },
  { label: "Readiness", href: "/compliance/check" },
  { label: "Consent", href: "/compliance/consent" },
  { label: "Suppression", href: "/compliance/suppression" },
  { label: "Events", href: "/compliance/events" },
];

const reasonToStatus: Record<string, string> = {
  stop: "Unsubscribed",
  STOP: "Unsubscribed",
  manual: "Blocked",
  blocked: "Blocked",
  invalid: "Invalid",
};

function mapReason(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes("stop")) return "STOP";
  if (lower.includes("block")) return "Blocked";
  if (lower.includes("invalid")) return "Invalid";
  return "Manual";
}

export default async function ComplianceSuppressionPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const suppressions = await loadSuppressions(workspaceId);

  const stopCount = suppressions.filter((e) =>
    (e.reason || "").toLowerCase().includes("stop"),
  ).length;
  const blockedCount = suppressions.filter((e) =>
    (e.reason || "").toLowerCase().includes("block") ||
    (e.reason || "").toLowerCase() === "manual",
  ).length;
  const invalidCount = suppressions.filter((e) =>
    (e.reason || "").toLowerCase().includes("invalid"),
  ).length;

  return (
    <div>
      <PageHeader
        title="Suppression list"
        description="Combined STOP opt-outs, manual blocks, and invalid numbers — excluded from all sends."
        actions={<Button variant="outline">Export list</Button>}
      />

      <Tabs items={complianceTabs} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total suppressed" value={formatNumber(suppressions.length)} />
        <StatCard label="STOP opt-outs" value={formatNumber(stopCount)} />
        <StatCard label="Manual blocks" value={formatNumber(blockedCount)} />
        <StatCard label="Invalid numbers" value={formatNumber(invalidCount)} />
      </div>

      <Card>
        <CardTitle>Suppression entries</CardTitle>
        {suppressions.length === 0 ? (
          <p className="mt-4 py-8 text-center text-sm text-muted-foreground">
            No suppressed contacts yet. STOP replies and manual blocks will appear here.
          </p>
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Contact</TH>
                <TH>Phone</TH>
                <TH>Reason</TH>
                <TH>Source</TH>
                <TH>Date</TH>
              </TR>
            </THead>
            <TBody>
              {suppressions.map((entry) => {
                const reason = mapReason(entry.reason);
                const statusChip = reasonToStatus[entry.reason] || reasonToStatus[reason] || "Blocked";
                return (
                  <TR key={entry.id}>
                    <TD className="font-medium">{entry.email || "—"}</TD>
                    <TD>{entry.phone ? formatPhone(entry.phone) : "—"}</TD>
                    <TD>
                      <StatusChip status={statusChip} />
                    </TD>
                    <TD className="text-muted-foreground">{entry.source || "—"}</TD>
                    <TD className="text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Suppressed contacts are automatically excluded from campaigns and automations. STOP replies are processed
          immediately and cannot be overridden.
        </p>
      </Card>
    </div>
  );
}
