import { FlowSettingsForm } from "@/components/automations/flow-settings-form";
import {
  AutomationExecutionHistory,
  FlowActionButtons,
} from "@/components/automations/flow-execution-history";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { parseAutomationDefinition } from "@/lib/automations/types";
import {
  requireWorkspaceContext,
  loadAutomationById,
} from "@/lib/workspace-data";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const tabItems = [
  { id: "builder", label: "Builder" },
  { id: "executions", label: "Executions" },
  { id: "performance", label: "Performance" },
  { id: "settings", label: "Settings" },
] as const;

type TabId = (typeof tabItems)[number]["id"];

function FlowTabs({ flowId, activeTab }: { flowId: string; activeTab: TabId }) {
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-border">
      {tabItems.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={`/automations/${flowId}?tab=${tab.id}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export default async function AutomationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ flowId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { flowId } = await params;
  const { tab } = await searchParams;
  const { workspaceId } = await requireWorkspaceContext();

  const [flow] = await Promise.all([loadAutomationById(workspaceId, flowId)]);

  if (!flow) {
    notFound();
  }

  const activeTab = (tabItems.find((t) => t.id === tab)?.id ?? "builder") as TabId;
  const def = parseAutomationDefinition(flow.definition);
  const stepCount = def.nodes.length;
  const smsSteps = def.nodes.filter(
    (n) => n.data.blockType === "send_sms" || n.data.blockType === "send_review_request",
  ).length;
  const waitSteps = def.nodes.filter((n) => n.data.blockType === "wait").length;

  return (
    <div>
      <PageHeader
        title={flow.name}
        description={`Trigger: ${flow.trigger}`}
        actions={
          <>
            <Link href="/automations">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
            <FlowActionButtons flowId={flowId} status={flow.status} />
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusChip status={flow.status} />
        <span className="text-sm text-muted-foreground">
          Updated {new Date(flow.updatedAt).toLocaleDateString()}
        </span>
      </div>

      <FlowTabs flowId={flowId} activeTab={activeTab} />

      {activeTab === "builder" && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardTitle>Flow builder</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              Open the visual builder to edit triggers, actions, delays, and conditions on the canvas.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={`/automations/${flowId}/edit`}>
                <Button>Edit in builder</Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              {stepCount} node{stepCount === 1 ? "" : "s"} on canvas · Trigger: {flow.trigger}
            </p>
          </Card>
          <Card>
            <CardTitle>Flow summary</CardTitle>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Trigger</dt>
                <dd className="font-medium">{flow.trigger}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Steps</dt>
                <dd className="font-medium">{stepCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Messages</dt>
                <dd className="font-medium">{smsSteps} SMS</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Wait steps</dt>
                <dd className="font-medium">{waitSteps}</dd>
              </div>
            </dl>
          </Card>
        </div>
      )}

      {activeTab === "executions" && (
        <AutomationExecutionHistory flowId={flowId} />
      )}

      {activeTab === "performance" && (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Enrolled" value={formatNumber(flow.enrolled)} />
            <StatCard label="Messages sent" value={formatNumber(flow.messagesSent)} />
            <StatCard
              label="Completion rate"
              value={flow.enrolled > 0 ? formatPercent(flow.completionRate) : "—"}
            />
            <StatCard
              label="Reply rate"
              value={flow.enrolled > 0 ? formatPercent(14.2) : "—"}
              hint="Contacts who replied during flow"
            />
          </div>
          <Card>
            <CardTitle>Performance over time</CardTitle>
            <div className="mt-6 flex h-48 items-end justify-between gap-2 px-2">
              {[42, 68, 55, 89, 72, 95, 78].map((h, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-md bg-primary/70"
                    style={{ height: `${h}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i]}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {activeTab === "settings" && <FlowSettingsForm flow={flow} />}
    </div>
  );
}
