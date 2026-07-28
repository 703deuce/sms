import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { automations, contacts } from "@/lib/mock/data";
import { cn, formatNumber, formatPercent } from "@/lib/utils";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Expand,
  ExternalLink,
  MessageSquare,
  Pause,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
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

const flowLogs = [
  {
    id: "fl_1",
    contact: "Maya Chen",
    event: "Enrollment",
    step: "Trigger fired",
    status: "Complete",
    at: "2026-07-27T14:22:00Z",
  },
  {
    id: "fl_2",
    contact: "Maya Chen",
    event: "Action",
    step: "Send SMS",
    status: "Delivered",
    at: "2026-07-27T14:22:05Z",
  },
  {
    id: "fl_3",
    contact: "Luis Ortiz",
    event: "Action",
    step: "Send SMS",
    status: "Delivered",
    at: "2026-07-26T11:08:00Z",
  },
];

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
    <div className="mb-5 flex flex-wrap gap-1 border-b border-border">
      {tabItems.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Link
            key={tab.id}
            href={`/automations/${flowId}?tab=${tab.id}`}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-[13px] font-semibold transition",
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
  const flow = automations.find((a) => a.id === flowId);

  if (!flow) {
    notFound();
  }

  const activeTab = (tabItems.find((t) => t.id === tab)?.id ?? "builder") as TabId;
  const enrolledContacts = contacts.filter((c) => c.status === "Subscribed").slice(0, 4);

  return (
    <div className="text-[13px]">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-[24px] font-bold tracking-tight text-foreground">
              {flow.name}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Trigger: {flow.trigger}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
              <StatusChip status={flow.status} />
              <span className="text-[12px] text-muted-foreground">
                Updated {new Date(flow.updatedAt).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center gap-1 text-[12px] text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                {formatNumber(flow.enrolled)} enrolled
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/automations">
            <Button variant="outline" className="rounded-[10px]">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          {flow.status === "Draft" ? (
            <Button className="rounded-[10px]">Activate flow</Button>
          ) : flow.status === "Paused" ? (
            <Button className="rounded-[10px]">Resume</Button>
          ) : (
            <Button variant="outline" className="rounded-[10px]">
              <Pause className="h-4 w-4" />
              Pause
            </Button>
          )}
        </div>
      </div>

      <FlowTabs flowId={flowId} activeTab={activeTab} />

      {activeTab === "builder" && (
        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <Card className="rounded-[12px] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-foreground">Flow canvas</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:bg-muted"
                  aria-label="Fullscreen"
                >
                  <Expand className="h-3.5 w-3.5" />
                </button>
                <select className="h-8 rounded-[8px] border border-border bg-card px-2 text-[12px]">
                  <option>100%</option>
                  <option>75%</option>
                  <option>125%</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col items-center py-4">
              <div className="flex w-full max-w-xs items-center gap-2.5 rounded-[12px] border-2 border-emerald-300 bg-emerald-50 px-4 py-3">
                <Zap className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="text-[13px] font-bold">Trigger</p>
                  <p className="text-[12px] text-muted-foreground">{flow.trigger}</p>
                </div>
              </div>
              <div className="flex h-8 items-center">
                <div className="h-full w-px bg-border" />
              </div>
              <div className="flex w-full max-w-xs items-center gap-2.5 rounded-[12px] border-2 border-amber-300 bg-amber-50 px-4 py-3">
                <Clock className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-[13px] font-bold">Wait</p>
                  <p className="text-[12px] text-muted-foreground">24 hours</p>
                </div>
              </div>
              <div className="flex h-8 items-center">
                <div className="h-full w-px bg-border" />
              </div>
              <div className="flex w-full max-w-xs items-center gap-2.5 rounded-[12px] border-2 border-sky-300 bg-sky-50 px-4 py-3">
                <MessageSquare className="h-4 w-4 text-sky-600" />
                <div>
                  <p className="text-[13px] font-bold">Send SMS</p>
                  <p className="text-[12px] text-muted-foreground">Welcome message</p>
                </div>
              </div>
            </div>

            <div className="mt-2 flex justify-center">
              <Link href="/automations/new">
                <Button variant="outline" size="sm" className="rounded-[10px]">
                  Edit in builder
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="rounded-[12px] p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-bold text-foreground">Flow summary</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Healthy
              </span>
            </div>
            <dl className="space-y-3 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Trigger</dt>
                <dd className="text-right font-medium">{flow.trigger}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Steps</dt>
                <dd className="font-medium">3</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Messages</dt>
                <dd className="font-medium">2 SMS</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Wait steps</dt>
                <dd className="font-medium">1</dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                This flow
              </p>
              <div className="mt-3 space-y-2.5">
                <div className="flex items-center justify-between rounded-[10px] bg-muted/40 px-3 py-2.5">
                  <span className="font-semibold">{formatNumber(flow.enrolled)} enrolled</span>
                  <span className="text-[12px] font-semibold text-emerald-600">+18%</span>
                </div>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-[10px] bg-muted/40 px-3 py-2.5 text-left hover:bg-muted/70"
                >
                  <span className="inline-flex items-center gap-2 font-semibold">
                    {flow.enrolled > 0 ? formatPercent(flow.completionRate) : "—"} completion rate
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === "performance" && (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-[12px] p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Enrolled
              </p>
              <p className="mt-2 text-[22px] font-bold">{formatNumber(flow.enrolled)}</p>
            </Card>
            <Card className="rounded-[12px] p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Messages sent
              </p>
              <p className="mt-2 text-[22px] font-bold">{formatNumber(flow.messagesSent)}</p>
            </Card>
            <Card className="rounded-[12px] p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Completion rate
              </p>
              <p className="mt-2 text-[22px] font-bold">
                {flow.enrolled > 0 ? formatPercent(flow.completionRate) : "—"}
              </p>
            </Card>
            <Card className="rounded-[12px] p-4">
              <p className="text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
                Reply rate
              </p>
              <p className="mt-2 text-[22px] font-bold">
                {flow.enrolled > 0 ? formatPercent(14.2) : "—"}
              </p>
            </Card>
          </div>
          <Card className="rounded-[12px] p-4">
            <h2 className="text-[14px] font-bold">Performance over time</h2>
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
        <Card className="rounded-[12px] p-4">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-[14px] font-bold">Enrolled contacts</h2>
          </div>
          <Table className="text-[13px]">
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
              {enrolledContacts.map((contact, idx) => (
                <TR key={contact.id}>
                  <TD>
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-semibold text-primary hover:underline"
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
                    {formatDateTime(`2026-07-2${idx}T10:00:00Z`)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {activeTab === "logs" && (
        <Card className="rounded-[12px] p-4">
          <h2 className="mb-4 text-[14px] font-bold">Flow activity</h2>
          <Table className="text-[13px]">
            <THead>
              <TR>
                <TH>Time</TH>
                <TH>Contact</TH>
                <TH>Event</TH>
                <TH>Step</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {flowLogs.map((log) => (
                <TR key={log.id}>
                  <TD className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(log.at)}
                  </TD>
                  <TD className="font-semibold">{log.contact}</TD>
                  <TD>
                    <span className="inline-flex rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold">
                      {log.event}
                    </span>
                  </TD>
                  <TD className="text-muted-foreground">{log.step}</TD>
                  <TD>
                    <StatusChip status={log.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {activeTab === "settings" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="rounded-[12px] p-4">
            <h2 className="text-[14px] font-bold">General</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="flow-name">Flow name</Label>
                <Input id="flow-name" defaultValue={flow.name} className="mt-1.5 rounded-[10px]" />
              </div>
              <div>
                <Label htmlFor="flow-status">Status</Label>
                <Select
                  id="flow-status"
                  defaultValue={flow.status}
                  className="mt-1.5 h-10 rounded-[10px]"
                >
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Draft">Draft</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="re-enroll">Re-enrollment</Label>
                <Select id="re-enroll" defaultValue="once" className="mt-1.5 h-10 rounded-[10px]">
                  <option value="once">Allow once per contact</option>
                  <option value="always">Allow every time trigger fires</option>
                  <option value="never">Never re-enroll</option>
                </Select>
              </div>
            </div>
          </Card>
          <Card className="rounded-[12px] p-4">
            <h2 className="text-[14px] font-bold">Send window</h2>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  id="timezone"
                  defaultValue="America/Los_Angeles"
                  className="mt-1.5 h-10 rounded-[10px]"
                >
                  <option>America/Los_Angeles</option>
                  <option>America/New_York</option>
                  <option>America/Chicago</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start">Send from</Label>
                  <Input
                    id="start"
                    type="time"
                    defaultValue="09:00"
                    className="mt-1.5 rounded-[10px]"
                  />
                </div>
                <div>
                  <Label htmlFor="end">Send until</Label>
                  <Input
                    id="end"
                    type="time"
                    defaultValue="20:00"
                    className="mt-1.5 rounded-[10px]"
                  />
                </div>
              </div>
              <p className="text-[12px] text-muted-foreground">
                Messages scheduled outside this window will queue until the next allowed time.
              </p>
              <Button className="rounded-[10px]">Save settings</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
