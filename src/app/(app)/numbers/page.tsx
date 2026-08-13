import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetricCard,
  PaginationBar,
  SectionHeader,
  TableToolbar,
} from "@/components/ui/metric";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import { requireWorkspaceContext, loadPhoneNumbers } from "@/lib/workspace-data";
import { cn, formatCurrency, formatPhone } from "@/lib/utils";
import {
  Calendar,
  Layers,
  MoreHorizontal,
  Phone,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";

const numberTabs = [
  { label: "My Numbers", href: "/numbers" },
  { label: "Buy", href: "/numbers/buy" },
  { label: "Port", href: "/numbers/port" },
  { label: "Sender Pools", href: "/numbers/pools" },
];

const cityByAreaCode: Record<string, string> = {
  "415": "San Francisco, CA",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const avatarTones = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
];

function formatA2pDate(status: string) {
  if (status === "Approved") return "Approved";
  if (status === "Pending") return "Submitted";
  return "—";
}

export default async function NumbersPage() {
  const { workspaceId } = await requireWorkspaceContext();
  const phoneNumbers = await loadPhoneNumbers(workspaceId);

  const activeCount = phoneNumbers.filter((pn) => pn.status === "Active").length;
  const monthlySpend = phoneNumbers.reduce((sum, pn) => sum + pn.monthlyCost, 0);
  const a2pRegistered = phoneNumbers.filter((pn) => pn.a2pStatus === "Approved").length;
  const allA2pApproved =
    phoneNumbers.length > 0 && phoneNumbers.every((pn) => pn.a2pStatus === "Approved");

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={Phone}
        iconTone="bg-violet-50 text-violet-600"
        title="Phone numbers"
        description="Manage sending numbers, A2P registration status, and monthly costs."
        actions={
          <>
            <Link href="/numbers/port">
              <Button variant="outline" className="h-9 rounded-[10px] text-[13px]">
                Port a number
              </Button>
            </Link>
            <Link href="/numbers/buy">
              <Button className="h-9 rounded-[10px] text-[13px]">Buy number</Button>
            </Link>
          </>
        }
      />

      <Tabs items={numberTabs} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active numbers"
          value={activeCount}
          hint="Total active"
          icon={Phone}
          tone="bg-violet-50 text-violet-600"
          sparkline={[1, 1, 2, 2, 2, 2, 2, 2]}
          sparkColor="#10b981"
        />
        <MetricCard
          label="A2P registered"
          value={a2pRegistered}
          hint={
            phoneNumbers.length
              ? `${Math.round((a2pRegistered / phoneNumbers.length) * 100)}% registered`
              : "No numbers"
          }
          icon={Shield}
          tone="bg-violet-50 text-violet-600"
          sparkline={[1, 1, 1, 2, 2, 2, 2, 2]}
          sparkColor="#8b5cf6"
        />
        <MetricCard
          label="Monthly spend"
          value={formatCurrency(monthlySpend)}
          hint="Across all numbers"
          icon={Layers}
          tone="bg-indigo-50 text-indigo-600"
          sparkline={[2, 2, 3, 3, 3, 3, 3, 3]}
          sparkColor="#3b82f6"
        />
        <MetricCard
          label="Next payment"
          value="—"
          hint="Billing cycle"
          icon={Calendar}
          tone="bg-orange-50 text-orange-600"
        />
      </div>

      <Card className="p-5">
        <TableToolbar title="My numbers" searchPlaceholder="Search numbers…">
          <Button variant="outline" size="sm" className="h-9 rounded-[10px] text-[13px]">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
        </TableToolbar>

        {phoneNumbers.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-muted-foreground">
            No phone numbers yet.{" "}
            <Link href="/numbers/buy" className="text-primary hover:underline">
              Buy a number
            </Link>
            to get started.
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Number</TH>
                <TH>Friendly name</TH>
                <TH>Type</TH>
                <TH>A2P status</TH>
                <TH>Messaging service</TH>
                <TH>Assigned</TH>
                <TH>Monthly</TH>
                <TH>Status</TH>
                <TH className="w-10" />
              </TR>
            </THead>
            <TBody>
              {phoneNumbers.map((pn, index) => (
                <TR key={pn.id}>
                  <TD>
                    <Link
                      href={`/numbers/${pn.id}`}
                      className="flex items-start gap-2.5 hover:opacity-80"
                    >
                      <span className="relative mt-1.5 flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
                      </span>
                      <span>
                        <span className="block font-semibold text-foreground">
                          {formatPhone(pn.number)}
                        </span>
                        <span className="mt-0.5 block text-[12px] text-muted-foreground">
                          {cityByAreaCode[pn.areaCode] ?? "—"}
                        </span>
                      </span>
                    </Link>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium">{pn.friendlyName}</span>
                      {index === 0 ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Default
                        </span>
                      ) : null}
                    </div>
                  </TD>
                  <TD className="text-[13px] text-muted-foreground">{pn.type}</TD>
                  <TD>
                    <div className="space-y-1">
                      <StatusChip status={pn.a2pStatus} />
                      <p className="text-[11px] text-muted-foreground">
                        {formatA2pDate(pn.a2pStatus)}
                      </p>
                    </div>
                  </TD>
                  <TD>
                    <span className="inline-flex items-center gap-2 text-[13px]">
                      <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-slate-100 text-slate-600">
                        <Layers className="h-3.5 w-3.5" />
                      </span>
                      <span>
                        <span className="block font-medium text-foreground">Enterprise</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {pn.messagingService}
                        </span>
                      </span>
                    </span>
                  </TD>
                  <TD>
                    {pn.assignedUsers.length > 0 ? (
                      <>
                        <div className="flex items-center -space-x-2">
                          {pn.assignedUsers.map((user, i) => (
                            <span
                              key={user}
                              title={user}
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ring-2 ring-card",
                                avatarTones[i % avatarTones.length],
                              )}
                            >
                              {initials(user)}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          {pn.assignedUsers.join(", ")}
                        </p>
                      </>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    )}
                  </TD>
                  <TD className="tabular-nums">{formatCurrency(pn.monthlyCost)}</TD>
                  <TD>
                    <StatusChip status={pn.status} />
                  </TD>
                  <TD>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Actions for ${pn.friendlyName}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}

        <PaginationBar
          rangeLabel={
            phoneNumbers.length
              ? `1–${phoneNumbers.length} of ${phoneNumbers.length}`
              : "0 of 0"
          }
        />
      </Card>

      {allA2pApproved ? (
        <div className="flex flex-col gap-3 rounded-[12px] border border-violet-200/80 bg-violet-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
            <div>
              <p className="text-[13px] font-semibold text-violet-950">
                A2P 10DLC compliance
              </p>
              <p className="mt-0.5 text-[12px] text-violet-900/80">
                All active numbers are A2P 10DLC registered and compliant.
              </p>
            </div>
          </div>
          <Link href="/compliance">
            <Button
              variant="outline"
              className="h-9 shrink-0 rounded-[10px] border-violet-300 bg-white text-[13px] text-violet-900 hover:bg-violet-50"
            >
              View compliance →
            </Button>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
