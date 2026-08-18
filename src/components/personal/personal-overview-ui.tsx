"use client";

import type { PersonalOverviewData } from "@/lib/workspace/personal-overview";
import {
  WIREFRAME_OVERVIEW_ACTIVITY_LOG,
  WIREFRAME_OVERVIEW_ANALYTICS,
  WIREFRAME_OVERVIEW_COMM_LOG,
  WIREFRAME_OVERVIEW_KPIS,
  WIREFRAME_OVERVIEW_NUMBER_REVIEW,
  WIREFRAME_OVERVIEW_PENDING_TASKS,
  WIREFRAME_OVERVIEW_TOP_CONTACTS,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { cn, formatPhone } from "@/lib/utils";
import {
  CheckCircle2,
  CreditCard,
  Phone,
  Plus,
  TrendingUp,
  Users,
  Vault,
} from "lucide-react";
import Link from "next/link";
import { PersonalMockSparkline } from "./mockup/charts";
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

const QUICK_ACTIONS = [
  { label: "Overview", href: "/personal" },
  { label: "Add a new number", href: "/personal/numbers/premium" },
  { label: "View call activity", href: "/personal/activity" },
  { label: "Create smart routing flow", href: "/smart-routing/new" },
  { label: "Park a number in vault", href: "/personal/vault" },
];

export function PersonalOverviewUI({
  data,
}: {
  data: PersonalOverviewData;
}) {
  const useWireframe = usePersonalWireframe(data.activityCount, 8);
  const wf = WIREFRAME_OVERVIEW_KPIS;
  const analytics = WIREFRAME_OVERVIEW_ANALYTICS;

  const kpis = useWireframe
    ? {
        totalContacts: wf.totalContacts,
        contactsAddedLastMonth: wf.contactsAddedLastMonth,
        activeNumbers: wf.activeNumbers,
        textsSent30d: wf.textsSent30d,
        calls30d: wf.calls30d,
        balance: wf.balance,
        balanceSub: wf.balanceSub,
        vaultCount: wf.vaultCount,
        vaultActive: wf.vaultActive,
      }
    : {
        totalContacts: data.kpis.totalContacts,
        contactsAddedLastMonth: data.kpis.contactsAddedLastMonth,
        activeNumbers: data.kpis.activeNumbers,
        textsSent30d: data.kpis.textsSent30d,
        calls30d: data.kpis.calls30d,
        balance: `$${data.kpis.balance.toFixed(2)}`,
        balanceSub: data.kpis.balanceSub,
        vaultCount: data.kpis.vaultCount,
        vaultActive: data.kpis.vaultActive,
      };

  const topContacts = useWireframe
    ? WIREFRAME_OVERVIEW_TOP_CONTACTS
    : data.topContacts;

  const numberReview = useWireframe ? WIREFRAME_OVERVIEW_NUMBER_REVIEW : data.numberReview;
  const pendingTasks = useWireframe ? WIREFRAME_OVERVIEW_PENDING_TASKS : data.pendingTasks;
  const commLog = useWireframe ? WIREFRAME_OVERVIEW_COMM_LOG : data.communicationLog;
  const activityLog = useWireframe ? WIREFRAME_OVERVIEW_ACTIVITY_LOG : data.recentActivityLog;
  const analyticsTotal = useWireframe ? analytics.total : data.analyticsTotal;
  const analyticsChange = useWireframe ? analytics.changePct : data.analyticsChangePct;
  const sparkline = useWireframe ? analytics.sparkline : data.monthlyPerformance;

  return (
    <PersonalMockPage>
      <PersonalMockHeader
        title="Overview"
        description="Your numbers, calls, and account at a glance."
        actions={
          <>
            <Link href="/personal/numbers/premium">
              <PersonalMockBtn>
                <Plus className="h-4 w-4" />
                Add Number
              </PersonalMockBtn>
            </Link>
            <Link href="/personal/activity">
              <PersonalMockBtn variant="outline">
                <Phone className="h-4 w-4" />
                Call Activity
              </PersonalMockBtn>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <PersonalMockKpi
          label="Frequent Callers"
          value={topContacts.length}
          sub={`${kpis.calls30d} calls this month`}
          icon={Users}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
        <PersonalMockKpi
          label="Active Numbers"
          value={kpis.activeNumbers}
          sub={`${kpis.activeNumbers} in service`}
          icon={TrendingUp}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalMockKpi
          label="Texts Sent (30d)"
          value={kpis.textsSent30d}
          sub="SMS this period"
          icon={Phone}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalMockKpi
          label="Calls (30d)"
          value={kpis.calls30d}
          sub="This Period"
          icon={Phone}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
        <PersonalMockKpi
          label="Current Month Balance"
          value={kpis.balance}
          sub={kpis.balanceSub}
          icon={CreditCard}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalMockKpi
          label="Number Vault"
          value={kpis.vaultCount}
          sub={`${kpis.vaultActive} Active numbers`}
          icon={Vault}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <PersonalMockSection
          title="Top Callers"
          description="Callers with the most activity this month"
          action={
            <div className="flex items-center gap-2">
              <PersonalMockSelect className="h-8 w-[100px] text-[12px]">
                <option>30 days</option>
                <option>7 days</option>
                <option>90 days</option>
              </PersonalMockSelect>
              <Link href="/personal/activity" className="text-[12px] font-semibold text-[#2563eb]">
                View all
              </Link>
            </div>
          }
        >
          {topContacts.length === 0 ? (
            <p className={pm.muted}>No contact activity yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[880px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    <th className="pb-3 pr-3">Contact</th>
                    <th className="pb-3 pr-3">Recent Activity</th>
                    <th className="pb-3 pr-3">Type</th>
                    <th className="pb-3 pr-3">Line</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Total Activity</th>
                    <th className="pb-3 pr-3">Last Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {topContacts.map((row) => (
                    <tr key={row.id}>
                      <td className="py-3 pr-3">
                        <p className="font-semibold text-[#111827]">{formatPhone(row.phone)}</p>
                        <p className="text-[11px] text-[#9ca3af]">{row.location}</p>
                      </td>
                      <td className="py-3 pr-3 text-[#6b7280]">{row.recentActivity}</td>
                      <td className="py-3 pr-3 text-[#6b7280]">{row.type}</td>
                      <td className="py-3 pr-3 text-[#6b7280]">{row.line}</td>
                      <td className="py-3 pr-3">
                        <PersonalMockPill tone={row.statusTone}>{row.status}</PersonalMockPill>
                      </td>
                      <td className="py-3 pr-3 font-medium text-[#111827]">{row.totalActivity}</td>
                      <td className="py-3 pr-3 text-[#6b7280]">{row.lastAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PersonalMockSection>

        <div className="space-y-4">
          <PersonalMockSection title="Quick Actions">
            <ul className="space-y-1 text-[13px]">
              {QUICK_ACTIONS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-2 py-2 font-medium text-[#2563eb] hover:bg-[#f9fafb]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </PersonalMockSection>

          <PersonalMockSection title="Number Review">
            <ul className="space-y-2 text-[13px]">
              {[
                { label: "Total", value: numberReview.total },
                { label: "Mobile", value: numberReview.mobile },
                { label: "Landline", value: numberReview.landline },
                { label: "VoIP", value: numberReview.voip },
                { label: "Invalid", value: numberReview.invalid },
              ].map((row) => (
                <li key={row.label} className="flex justify-between">
                  <span className="text-[#6b7280]">{row.label}</span>
                  <span className="font-semibold text-[#111827]">{row.value}</span>
                </li>
              ))}
            </ul>
          </PersonalMockSection>

          <PersonalMockSection title="Number Vault">
            <div className="space-y-2 text-[13px]">
              <Link
                href="/personal/vault"
                className="block font-semibold text-[#2563eb] hover:underline"
              >
                Add numbers to vault
              </Link>
              <Link
                href="/personal/vault"
                className="block font-semibold text-[#2563eb] hover:underline"
              >
                View vault
              </Link>
            </div>
          </PersonalMockSection>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <PersonalMockSection title="Analytics">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[12px] text-[#6b7280]">Total</p>
                <p className="text-[28px] font-bold text-[#111827]">{analyticsTotal}</p>
                <p
                  className={cn(
                    "mt-1 text-[12px] font-semibold",
                    analyticsChange >= 0 ? "text-[#059669]" : "text-[#dc2626]",
                  )}
                >
                  {analyticsChange >= 0 ? "↑" : "↓"} {Math.abs(analyticsChange)}%
                </p>
              </div>
              <PersonalMockSparkline points={sparkline} color="#2563eb" width={80} height={32} />
            </div>
          </PersonalMockSection>

          <PersonalMockSection title="Pending Tasks">
            {pendingTasks.length === 0 ? (
              <p className={pm.muted}>No pending tasks.</p>
            ) : (
              <ul className="space-y-3 text-[13px]">
                {pendingTasks.map((task) => (
                  <li key={task.id} className="flex justify-between gap-2">
                    <span className="text-[#111827]">{task.text}</span>
                    <span className="shrink-0 text-[11px] text-[#9ca3af]">{task.at}</span>
                  </li>
                ))}
              </ul>
            )}
          </PersonalMockSection>
        </div>

        <div className="space-y-4">
          <PersonalMockSection title="Balance & Billing">
            <p className="text-[28px] font-bold text-[#111827]">{kpis.balance}</p>
            <p className="mt-1 text-[12px] text-[#6b7280]">{kpis.balanceSub}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/settings/billing">
                <PersonalMockBtn>Refill Now</PersonalMockBtn>
              </Link>
            </div>
            <Link
              href="/settings/billing"
              className="mt-4 block text-[12px] font-semibold text-[#2563eb]"
            >
              Manage billing & credits
            </Link>
          </PersonalMockSection>

          <PersonalMockSection title="Service Status">
            <div className="flex items-center gap-2 text-[13px]">
              <CheckCircle2 className="h-5 w-5 text-[#059669]" />
              <span className="font-semibold text-[#059669]">System Status: Online</span>
            </div>
          </PersonalMockSection>
        </div>

        <div className="space-y-4">
          <PersonalMockSection title="Communication Log">
            <ul className="space-y-2 text-[13px]">
              {commLog.map((row, i) => (
                <li key={`${row.phone}-${i}`} className="flex justify-between gap-2">
                  <span className="font-medium text-[#111827]">{formatPhone(row.phone)}</span>
                  <span className="text-[11px] text-[#9ca3af]">
                    {row.date} {row.time}
                  </span>
                </li>
              ))}
            </ul>
          </PersonalMockSection>

          <PersonalMockSection title="Monthly Performance">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-[#6b7280]">Call volume trend</p>
              <PersonalMockSparkline points={sparkline} color="#2563eb" width={120} height={36} />
            </div>
          </PersonalMockSection>

          <PersonalMockSection title="Recent Activity Log">
            <ul className="space-y-2 text-[13px]">
              {activityLog.map((row) => (
                <li key={row.id} className="flex justify-between gap-2">
                  <span className="text-[#111827]">{row.text}</span>
                  <span className="shrink-0 text-[11px] text-[#9ca3af]">{row.at}</span>
                </li>
              ))}
            </ul>
          </PersonalMockSection>
        </div>
      </div>
    </PersonalMockPage>
  );
}
