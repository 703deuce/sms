import { NumberSettingsForm } from "@/components/numbers/number-settings-form";
import {
  NumberAssignmentForm,
  NumberMessagingForm,
  NumberWebhooksForm,
} from "@/components/numbers/number-config-forms";
import { NumberProvisionPanel } from "@/components/numbers/number-provision-panel";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  requireWorkspaceContext,
  loadPhoneNumbers,
  loadTeamMembers,
} from "@/lib/workspace-data";
import { cn, formatCurrency, formatNumber, formatPhone } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/db";

const detailTabs = [
  { id: "overview", label: "Overview" },
  { id: "voice", label: "Voice + SMS" },
  { id: "messaging", label: "Messaging" },
  { id: "assignment", label: "Assignment" },
  { id: "compliance", label: "Compliance" },
  { id: "webhooks", label: "Webhooks" },
  { id: "usage", label: "Usage" },
  { id: "settings", label: "Settings" },
];

type PageProps = {
  params: Promise<{ numberId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function NumberDetailPage({ params, searchParams }: PageProps) {
  const { numberId } = await params;
  const { tab = "overview" } = await searchParams;
  const { workspaceId } = await requireWorkspaceContext();

  const [phoneNumbers, teamMembers] = await Promise.all([
    loadPhoneNumbers(workspaceId),
    loadTeamMembers(workspaceId),
  ]);

  const number = phoneNumbers.find((pn) => pn.id === numberId);
  if (!number) notFound();

  const registration = await getPrisma().messagingRegistration.findUnique({
    where: { workspaceId },
  });
  const isRegistrationNumber = registration?.phoneE164 === number.number;

  function statusLabel(status?: string | null) {
    const s = (status || "not_started").toLowerCase();
    if (s === "approved" || s === "ready" || s === "complete" || s === "completed") return "Approved";
    if (s === "rejected" || s === "failed" || s === "suspended") return "Rejected";
    if (s === "submitted" || s === "in_review" || s === "action_required") return "Pending";
    return "Draft";
  }
  const brandStatusLabel = statusLabel(registration?.brandStatus);
  const campaignStatusLabel = statusLabel(registration?.campaignStatus);
  const campaignApproved = campaignStatusLabel === "Approved";

  const usageLogs: Array<{
    id: string;
    to: string;
    campaign: string;
    status: string;
    cost: number;
    at: string;
  }> = [];
  const sentCount = 0;
  const deliveredCount = 0;
  const totalCost = 0;

  return (
    <div>
      <PageHeader
        title={formatPhone(number.number)}
        description={`${number.friendlyName} · ${number.type} · ${number.areaCode} area code`}
        actions={
          <>
            <Link href="/numbers">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
                All numbers
              </Button>
            </Link>
            <StatusChip status={number.status} />
          </>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1 border-b border-border">
        {detailTabs.map((item) => {
          const active = tab === item.id;
          return (
            <Link
              key={item.id}
              href={`/numbers/${numberId}?tab=${item.id}`}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="A2P status" value={number.a2pStatus} href="/compliance" />
            <StatCard label="Monthly cost" value={formatCurrency(number.monthlyCost)} />
            <StatCard label="Messages sent" value={formatNumber(sentCount)} />
            <StatCard
              label="Delivery rate"
              value={sentCount ? `${Math.round((deliveredCount / sentCount) * 100)}%` : "—"}
            />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card>
              <CardTitle>Number details</CardTitle>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">E.164</dt>
                  <dd className="font-medium">{number.number}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Friendly name</dt>
                  <dd className="font-medium">{number.friendlyName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Type</dt>
                  <dd>{number.type}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Messaging service</dt>
                  <dd>{number.messagingService}</dd>
                </div>
              </dl>
            </Card>
            <Card>
              <CardTitle>Assigned users</CardTitle>
              {number.assignedUsers.length > 0 ? (
                <ul className="mt-4 space-y-2">
                  {number.assignedUsers.map((user) => (
                    <li
                      key={user}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{user}</span>
                      <span className="text-xs text-muted-foreground">Inbox access</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">No users assigned yet.</p>
              )}
            </Card>
          </div>
        </>
      )}

      {tab === "voice" && <NumberProvisionPanel numberId={numberId} />}

      {tab === "messaging" && (
        <Card>
          <CardTitle>Messaging configuration</CardTitle>
          <NumberMessagingForm
            numberId={numberId}
            messagingService={number.messagingService}
            initialSettings={number.settingsJson ?? null}
          />
        </Card>
      )}

      {tab === "assignment" && (
        <Card>
          <CardTitle>User assignment</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            Assigned users can send from and receive replies to this number in the inbox.
          </p>
          <NumberAssignmentForm
            numberId={numberId}
            members={teamMembers.map((m) => ({
              id: m.id,
              name: m.name,
              email: m.email,
              role: m.role,
            }))}
            initialAssignedUserIds={number.assignedUserIds ?? []}
          />
        </Card>
      )}

      {tab === "compliance" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardTitle>A2P registration</CardTitle>
            <div className="mt-4 flex items-center gap-3">
              <StatusChip status={number.a2pStatus} />
              <span className="text-sm text-muted-foreground">
                {number.type === "Toll-free" ? "Toll-free verification" : "10DLC campaign linked"}
              </span>
            </div>
            {registration ? (
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Brand</dt>
                  <dd>
                    <StatusChip status={brandStatusLabel} />
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Campaign</dt>
                  <dd>
                    <StatusChip status={campaignStatusLabel} />
                  </dd>
                </div>
                {registration.campaignDisplayName || registration.useCase ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Use case</dt>
                    <dd>{registration.campaignDisplayName || registration.useCase}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No messaging registration found for this workspace yet.
              </p>
            )}
            <p className="mt-4 text-sm text-muted-foreground">
              {campaignApproved
                ? "This number is approved for registered use cases."
                : "Complete brand and campaign registration to enable full throughput."}
            </p>
            <Link href="/compliance" className="mt-4 inline-flex">
              <Button variant="outline" size="sm">
                Open compliance center
              </Button>
            </Link>
          </Card>
          <Card>
            <CardTitle>Throughput limits</CardTitle>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Registration status</dt>
                <dd className="font-medium">{campaignApproved ? "Registered" : "Unregistered"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Daily segment limit</dt>
                <dd className="font-medium">{campaignApproved ? "10,000" : "200"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Per-minute rate</dt>
                <dd className="font-medium">{campaignApproved ? "60 MPS" : "1 MPS"}</dd>
              </div>
              {registration?.messageVolume ? (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Declared volume</dt>
                  <dd>{registration.messageVolume}</dd>
                </div>
              ) : null}
            </dl>
          </Card>
        </div>
      )}

      {tab === "webhooks" && (
        <Card>
          <CardTitle>Webhook endpoints</CardTitle>
          <NumberWebhooksForm numberId={numberId} initialWebhookUrl={number.webhookUrl ?? null} />
        </Card>
      )}

      {tab === "usage" && (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <StatCard label="Segments sent" value={formatNumber(sentCount)} />
            <StatCard label="Total cost" value={formatCurrency(totalCost)} />
            <StatCard
              label="Failed"
              value={formatNumber(usageLogs.filter((l) => l.status === "Failed").length)}
            />
          </div>
          <Card>
            <CardTitle>Recent messages</CardTitle>
            <Table className="mt-4">
              <THead>
                <TR>
                  <TH>To</TH>
                  <TH>Campaign</TH>
                  <TH>Status</TH>
                  <TH>Cost</TH>
                  <TH>Date</TH>
                </TR>
              </THead>
              <TBody>
                {usageLogs.length > 0 ? (
                  usageLogs.map((log) => (
                    <TR key={log.id}>
                      <TD className="font-medium">{formatPhone(log.to)}</TD>
                      <TD className="text-muted-foreground">{log.campaign}</TD>
                      <TD>
                        <StatusChip status={log.status} />
                      </TD>
                      <TD>{formatCurrency(log.cost)}</TD>
                      <TD className="text-muted-foreground">
                        {new Date(log.at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </TD>
                    </TR>
                  ))
                ) : (
                  <TR>
                    <TD colSpan={5} className="py-8 text-center text-muted-foreground">
                      No messages sent from this number yet.
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </Card>
        </>
      )}

      {tab === "settings" && (
        <Card>
          <CardTitle>Number settings</CardTitle>
          <NumberSettingsForm
            numberId={numberId}
            e164={number.number}
            initialFriendlyName={number.friendlyName}
            initialVoiceForwardTo={number.voiceForwardTo ?? null}
            isRegistrationNumber={isRegistrationNumber}
          />
        </Card>
      )}
    </div>
  );
}
