"use client";

import type { PersonalOverviewData } from "@/lib/workspace/personal-overview";
import {
  WIREFRAME_OVERVIEW_ACTIVE_DEVICES,
  WIREFRAME_OVERVIEW_ACTIVE_NUMBERS_LIST,
  WIREFRAME_OVERVIEW_CALL_ACTIVITY,
  WIREFRAME_OVERVIEW_CALL_STATUS,
  WIREFRAME_OVERVIEW_COMMUNICATIONS,
  WIREFRAME_OVERVIEW_INVOICES_LIST,
  WIREFRAME_OVERVIEW_KPIS,
  WIREFRAME_OVERVIEW_PENDING_DEPLOYMENTS,
  WIREFRAME_OVERVIEW_QUICK_NOTES,
  WIREFRAME_OVERVIEW_RECENT_REPORTS,
  WIREFRAME_OVERVIEW_SERVICES,
  WIREFRAME_OVERVIEW_TOP_EXTENSIONS,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { cn, formatPhone } from "@/lib/utils";
import {
  FileText,
  Hash,
  MessageCircle,
  MoreVertical,
  Phone,
  PhoneForwarded,
  Smartphone,
  Users,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { PersonalMockBarChart } from "./mockup/charts";
import {
  PersonalMockBtn,
  PersonalMockHeader,
  PersonalMockKpi,
  PersonalMockPage,
  PersonalMockPill,
  PersonalMockSection,
  PersonalMockSelect,
  pm,
} from "./mockup/primitives";

function WidgetFooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mt-4 block text-[12px] font-semibold text-[#6366f1] hover:underline"
    >
      {label}
    </Link>
  );
}

function CallTypeIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("land")) return <Phone className="h-4 w-4 text-[#9ca3af]" />;
  if (t.includes("voip")) return <Wifi className="h-4 w-4 text-[#9ca3af]" />;
  return <Smartphone className="h-4 w-4 text-[#9ca3af]" />;
}

export function PersonalOverviewUI({ data }: { data: PersonalOverviewData }) {
  const useWireframe = usePersonalWireframe(data.activityCount, 8);
  const wf = WIREFRAME_OVERVIEW_KPIS;

  const kpis = useWireframe
    ? wf
    : {
        phoneNumbers: data.kpis.phoneNumbers,
        totalExtensions: data.kpis.totalExtensions,
        forwardedNumbers: data.kpis.forwardedNumbers,
        agents: data.kpis.agents,
        monthlySpend: `$${data.kpis.monthlySpend.toFixed(2)}`,
        activeConversations: data.kpis.activeConversations,
      };

  const monthlySpendDisplay =
    typeof kpis.monthlySpend === "string"
      ? kpis.monthlySpend
      : `$${Number(kpis.monthlySpend).toFixed(2)}`;

  const callActivity = useWireframe ? WIREFRAME_OVERVIEW_CALL_ACTIVITY : data.callActivity;
  const topExtensions = useWireframe ? WIREFRAME_OVERVIEW_TOP_EXTENSIONS : data.topExtensions;
  const activeDevices = useWireframe ? WIREFRAME_OVERVIEW_ACTIVE_DEVICES : data.activeDevices;
  const quickNotes = useWireframe ? WIREFRAME_OVERVIEW_QUICK_NOTES : data.quickNotes;
  const invoices = useWireframe ? WIREFRAME_OVERVIEW_INVOICES_LIST : data.invoices;
  const pendingDeployments = useWireframe
    ? WIREFRAME_OVERVIEW_PENDING_DEPLOYMENTS
    : data.pendingDeployments;
  const activeNumbers = useWireframe ? WIREFRAME_OVERVIEW_ACTIVE_NUMBERS_LIST : data.activeNumbers;
  const services = useWireframe ? WIREFRAME_OVERVIEW_SERVICES : data.services;
  const communications = useWireframe ? WIREFRAME_OVERVIEW_COMMUNICATIONS : data.communications;
  const recentReports = useWireframe ? WIREFRAME_OVERVIEW_RECENT_REPORTS : data.recentReports;
  const callStatusOverview = useWireframe ? WIREFRAME_OVERVIEW_CALL_STATUS : data.callStatusOverview;

  return (
    <PersonalMockPage>
      <PersonalMockHeader
        title="Overview"
        description="Manage systems and other account details for the platform"
        actions={
          <>
            <PersonalMockBtn>Update Dashboard</PersonalMockBtn>
            <PersonalMockSelect className="h-9 min-w-[140px] text-[13px]">
              <option>All Accounts</option>
            </PersonalMockSelect>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <PersonalMockKpi
          label="Phone Numbers"
          value={kpis.phoneNumbers}
          sub="Active Numbers"
          icon={Phone}
          iconClass="bg-[#eef2ff] text-[#6366f1]"
        />
        <PersonalMockKpi
          label="Total Extensions"
          value={kpis.totalExtensions}
          sub="Total"
          icon={Hash}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalMockKpi
          label="Forwarded Numbers"
          value={kpis.forwardedNumbers}
          sub="Total Forwarded"
          icon={PhoneForwarded}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalMockKpi
          label="Agents"
          value={kpis.agents}
          sub="Total"
          icon={Users}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
        <PersonalMockKpi
          label="Monthly Spend Estimate"
          value={monthlySpendDisplay}
          sub="Effective this month"
          icon={FileText}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalMockKpi
          label="Active Conversations"
          value={kpis.activeConversations}
          sub="Effective this month"
          icon={MessageCircle}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <PersonalMockSection
          title="Call Activity"
          description="Review and view account details."
          action={
            <div className="flex items-center gap-2">
              <PersonalMockSelect className="h-8 text-[12px]">
                <option>Filter by Date Range</option>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
              </PersonalMockSelect>
              <PersonalMockSelect className="h-8 text-[12px]">
                <option>All Calls</option>
                <option>Inbound</option>
                <option>Outbound</option>
              </PersonalMockSelect>
            </div>
          }
        >
          {callActivity.length === 0 ? (
            <p className={pm.muted}>No call activity yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[880px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                      <th className="pb-3 pr-3">Date</th>
                      <th className="pb-3 pr-3">Extension/Agent</th>
                      <th className="pb-3 pr-3">Type</th>
                      <th className="pb-3 pr-3">Duration</th>
                      <th className="pb-3 pr-3">Outcome</th>
                      <th className="pb-3 pr-3">Direction</th>
                      <th className="pb-3 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6]">
                    {callActivity.map((row) => (
                      <tr key={row.id}>
                        <td className="py-3 pr-3 text-[#6b7280]">{row.date}</td>
                        <td className="py-3 pr-3 font-semibold text-[#111827]">
                          {row.extensionAgent}
                        </td>
                        <td className="py-3 pr-3">
                          <span className="inline-flex items-center gap-1.5 text-[#6b7280]">
                            <CallTypeIcon type={row.type} />
                            {row.type}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-[#6b7280]">{row.duration}</td>
                        <td className="py-3 pr-3 text-[#6b7280]">{row.outcome}</td>
                        <td className="py-3 pr-3 text-[#6b7280]">{row.direction}</td>
                        <td className="py-3 pr-3">
                          <PersonalMockPill tone={row.statusTone}>{row.status}</PersonalMockPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-right">
                <Link
                  href="/personal/activity"
                  className="text-[13px] font-semibold text-[#6366f1] hover:underline"
                >
                  View Activity Report →
                </Link>
              </div>
            </>
          )}
        </PersonalMockSection>

        <div className="space-y-4">
          <PersonalMockSection title="Top Extensions">
            <ul className="space-y-2 text-[13px]">
              {topExtensions.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-[#f9fafb]"
                >
                  <span className="font-medium text-[#111827]">{row.label}</span>
                  <button
                    type="button"
                    className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6]"
                    aria-label="Extension actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </PersonalMockSection>

          <PersonalMockSection title="Active Device">
            {activeDevices.length === 0 ? (
              <p className={pm.muted}>No active devices.</p>
            ) : (
              <ul className="space-y-3 text-[13px]">
                {activeDevices.map((row) => (
                  <li key={row.id}>
                    <p className="font-semibold text-[#111827]">{row.label}</p>
                    {row.sub ? <p className="text-[12px] text-[#9ca3af]">{row.sub}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </PersonalMockSection>

          <PersonalMockSection title="Quick Notes">
            {quickNotes.length === 0 ? (
              <p className={pm.muted}>No notes.</p>
            ) : (
              <ul className="space-y-2 text-[13px] text-[#374151]">
                {quickNotes.map((row) => (
                  <li key={row.id}>{row.text}</li>
                ))}
              </ul>
            )}
          </PersonalMockSection>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <PersonalMockSection title="Invoices">
            <ul className="space-y-2 text-[13px]">
              {invoices.map((row, i) => (
                <li key={`${row.label}-${i}`} className="flex justify-between gap-2">
                  <span className="text-[#374151]">{row.label}</span>
                  <span className="font-semibold text-[#111827]">{row.amount}</span>
                </li>
              ))}
            </ul>
            <Link href="/settings/billing" className="mt-4 block">
              <PersonalMockBtn className="w-full">View All Invoices</PersonalMockBtn>
            </Link>
          </PersonalMockSection>

          <PersonalMockSection title="Pending Deployments">
            {pendingDeployments.length === 0 ? (
              <p className={pm.muted}>No pending deployments.</p>
            ) : (
              <ul className="space-y-4 text-[13px]">
                {pendingDeployments.map((row) => (
                  <li key={row.id}>
                    <div className="flex justify-between text-[#374151]">
                      <span>{row.label}</span>
                      <span className="font-semibold text-[#111827]">{row.progress}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-[#e5e7eb]">
                      <div
                        className="h-2 rounded-full bg-[#6366f1]"
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PersonalMockSection>
        </div>

        <div className="space-y-4">
          <PersonalMockSection title="Active Numbers">
            {activeNumbers.length === 0 ? (
              <p className={pm.muted}>No active numbers.</p>
            ) : (
              <ul className="space-y-3 text-[13px]">
                {activeNumbers.map((row) => (
                  <li key={row.id}>
                    <p className="font-semibold text-[#111827]">{formatPhone(row.phone)}</p>
                    <p className="text-[12px] text-[#9ca3af]">({row.label})</p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/personal/numbers/premium" className="mt-4 block">
              <PersonalMockBtn variant="outline" className="w-full">Assign Number</PersonalMockBtn>
            </Link>
          </PersonalMockSection>

          <PersonalMockSection title="Service & Status">
            <ul className="space-y-3 text-[13px]">
              {services.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-2">
                  <span className="text-[#374151]">{row.label}</span>
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#059669]">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        row.online ? "bg-[#059669]" : "bg-[#9ca3af]",
                      )}
                    />
                    {row.online ? "Online" : "Offline"}
                  </span>
                </li>
              ))}
            </ul>
            <WidgetFooterLink href="/settings" label="Manage Status & Settings →" />
          </PersonalMockSection>
        </div>

        <div className="space-y-4">
          <PersonalMockSection title="Communications">
            {communications.length === 0 ? (
              <p className={pm.muted}>No communications yet.</p>
            ) : (
              <ul className="space-y-2 text-[13px]">
                {communications.map((row, i) => (
                  <li key={`${row.phone}-${i}`} className="flex justify-between gap-2">
                    <span className="font-medium text-[#111827]">{formatPhone(row.phone)}</span>
                    <span className="text-[11px] text-[#9ca3af]">{row.at}</span>
                  </li>
                ))}
              </ul>
            )}
          </PersonalMockSection>

          <PersonalMockSection title="Recent Reports">
            <ul className="space-y-3 text-[13px]">
              {recentReports.map((row) => (
                <li key={row.name} className="flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-[#6366f1]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-[#111827]">{row.name}</p>
                    <p className="text-[11px] text-[#9ca3af]">{row.size}</p>
                  </div>
                </li>
              ))}
            </ul>
          </PersonalMockSection>

          <PersonalMockSection title="Call Status Overview">
            <PersonalMockBarChart items={callStatusOverview} barClass="bg-[#6366f1]" />
          </PersonalMockSection>
        </div>
      </div>
    </PersonalMockPage>
  );
}
