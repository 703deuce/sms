import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { automations, contacts } from "@/lib/mock/data";
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
  const flow = automations.find((a) => a.id === flowId);

  if (!flow) {
    notFound();
  }

  const activeTab = (tabItems.find((t) => t.id === tab)?.id ?? "builder") as TabId;
  const enrolledContacts = contacts.filter((c) => c.status === "Subscribed").slice(0, 4);

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
              {enrolledContacts.map((contact, idx) => (
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
                    {formatDateTime("2026-07-2" + idx + "T10:00:00Z")}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {activeTab === "logs" && (
        <Card>
          <CardTitle>Flow activity</CardTitle>
          <div className="mt-4">
            <Table>
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
                    <TD className="font-medium">{log.contact}</TD>
                    <TD>
                      <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
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
          </div>
        </Card>
      )}

      {activeTab === "settings" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>General</CardTitle>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="flow-name">Flow name</Label>
                <Input id="flow-name" defaultValue={flow.name} />
              </div>
              <div>
                <Label htmlFor="flow-status">Status</Label>
                <Select id="flow-status" defaultValue={flow.status}>
                  <option value="Active">Active</option>
                  <option value="Paused">Paused</option>
                  <option value="Draft">Draft</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="re-enroll">Re-enrollment</Label>
                <Select id="re-enroll" defaultValue="once">
                  <option value="once">Allow once per contact</option>
                  <option value="always">Allow every time trigger fires</option>
                  <option value="never">Never re-enroll</option>
                </Select>
              </div>
            </div>
          </Card>
          <Card>
            <CardTitle>Send window</CardTitle>
            <div className="mt-4 space-y-4">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select id="timezone" defaultValue="America/Los_Angeles">
                  <option>America/Los_Angeles</option>
                  <option>America/New_York</option>
                  <option>America/Chicago</option>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start">Send from</Label>
                  <Input id="start" type="time" defaultValue="09:00" />
                </div>
                <div>
                  <Label htmlFor="end">Send until</Label>
                  <Input id="end" type="time" defaultValue="20:00" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Messages scheduled outside this window will queue until the next allowed time.
              </p>
              <Button>Save settings</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
