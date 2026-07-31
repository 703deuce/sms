import { FlowSettingsForm } from "@/components/automations/flow-settings-form";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import type { Contact } from "@/lib/types";
import {
  requireWorkspaceContext,
  loadAutomationById,
  loadContacts,
} from "@/lib/workspace-data";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import { ArrowLeft, Clock, MessageSquare, Users, Zap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

const tabItems = [
  { id: "builder", label: "Builder" },
  { id: "performance", label: "Performance" },
  { id: "contacts", label: "Contacts" },
  { id: "logs", label: "Logs" },
  { id: "settings", label: "Settings" },
] as const;

type TabId = (typeof tabItems)[number]["id"];

function formatDateTime(at: string) {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

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

  const [flow, contacts] = await Promise.all([
    loadAutomationById(workspaceId, flowId),
    loadContacts(workspaceId, "subscribed"),
  ]);

  if (!flow) {
    notFound();
  }

  const activeTab = (tabItems.find((t) => t.id === tab)?.id ?? "builder") as TabId;
  const enrolledContacts = contacts.slice(0, 4);

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
            {flow.status === "Draft" ? (
              <Button>Activate flow</Button>
            ) : flow.status === "Paused" ? (
              <Button>Resume</Button>
            ) : (
              <Button variant="outline">Pause</Button>
            )}
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
            <CardTitle>Flow canvas</CardTitle>
            <div className="mt-6 flex flex-col items-center space-y-2 py-4">
              <div className="flex w-full max-w-xs items-center gap-2 rounded-xl border-2 border-primary bg-primary/5 px-4 py-3">
                <Zap className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Trigger</p>
                  <p className="text-xs text-muted-foreground">{flow.trigger}</p>
                </div>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex w-full max-w-xs items-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3">
                <Clock className="h-4 w-4 text-amber-700" />
                <div>
                  <p className="text-sm font-semibold">Wait</p>
                  <p className="text-xs text-muted-foreground">24 hours</p>
                </div>
              </div>
              <div className="h-6 w-px bg-border" />
              <div className="flex w-full max-w-xs items-center gap-2 rounded-xl border-2 border-sky-300 bg-sky-50 px-4 py-3">
                <MessageSquare className="h-4 w-4 text-sky-700" />
                <div>
                  <p className="text-sm font-semibold">Send SMS</p>
                  <p className="text-xs text-muted-foreground">Welcome message</p>
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <Link href={`/automations/new`}>
                <Button variant="outline" size="sm">
                  Edit in builder
                </Button>
              </Link>
            </div>
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
                <dd className="font-medium">3</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Messages</dt>
                <dd className="font-medium">2 SMS</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Wait steps</dt>
                <dd className="font-medium">1</dd>
              </div>
            </dl>
          </Card>
        </div>
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

      {activeTab === "contacts" && (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <CardTitle>Enrolled contacts</CardTitle>
          </div>
          {enrolledContacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No enrolled contacts yet.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Phone</TH>
                  <TH>Status</TH>
                  <TH>Current step</TH>
                  <TH>Enrolled</TH>
                </TR>
              </THead>
              <TBody>
                {enrolledContacts.map((contact: Contact, idx: number) => (
                  <TR key={contact.id}>
                    <TD>
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {contact.firstName} {contact.lastName}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">{contact.phone}</TD>
                    <TD>
                      <StatusChip status={contact.status} />
                    </TD>
                    <TD className="text-muted-foreground">
                      {idx === 0 ? "Wait 24h" : idx === 1 ? "Send SMS" : "Completed"}
                    </TD>
                    <TD className="text-muted-foreground">
                      {contact.dateAdded || "—"}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {activeTab === "logs" && (
        <Card>
          <CardTitle>Flow activity</CardTitle>
          <p className="mt-4 py-8 text-center text-sm text-muted-foreground">
            No activity logs for this flow yet.
          </p>
        </Card>
      )}

      {activeTab === "settings" && <FlowSettingsForm flow={flow} />}
    </div>
  );
}
