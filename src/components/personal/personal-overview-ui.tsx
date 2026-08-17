"use client";

import type { PersonalOverviewData } from "@/lib/workspace/personal-overview";
import {
  WIREFRAME_OVERVIEW_BILLING_HISTORY,
  WIREFRAME_OVERVIEW_KPIS,
  WIREFRAME_OVERVIEW_PENDING_TRANSFERS,
  WIREFRAME_OVERVIEW_RECENT_NUMBERS,
  WIREFRAME_OVERVIEW_RECENT_VOICEMAIL,
  WIREFRAME_OVERVIEW_TIMELINE,
  WIREFRAME_OVERVIEW_TOP_CALL_NUMBERS,
  WIREFRAME_OVERVIEW_TOP_DESTINATIONS,
  WIREFRAME_OVERVIEW_TOP_NUMBERS,
  usePersonalWireframe,
} from "@/lib/workspace/personal-mockup-wireframe";
import { formatPhone } from "@/lib/utils";
import {
  AlertTriangle,
  BookOpen,
  CreditCard,
  Download,
  MessageSquare,
  Mic,
  MoreVertical,
  Phone,
  PhoneCall,
  Plus,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { PersonalMockBarChart, PersonalMockSparkline } from "./mockup/charts";
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

const QUICK_MENU = [
  { label: "Downloads", href: "/settings", icon: Download },
  { label: "Documentation", href: "/help", icon: BookOpen },
  { label: "Manage team", href: "/settings/team", icon: Users },
  { label: "Billing details", href: "/settings/billing", icon: CreditCard },
  { label: "Wallet history", href: "/settings/billing", icon: Wallet },
  { label: "Integration status", href: "/settings/integrations", icon: Settings },
];

const QUICK_ACTIONS = [
  { label: "Buy a number", href: "/personal/numbers/premium", done: true },
  { label: "Port number", href: "/personal/porting", done: true },
  { label: "Set voicemail", href: "/personal/voicemail", done: true },
  { label: "Send sms", href: "/campaigns/new", done: false },
  { label: "Analytics", href: "/personal/analytics", done: false },
  { label: "API Settings", href: "/settings/api", done: false },
];

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

export function PersonalOverviewUI({ data }: { data: PersonalOverviewData }) {
  const useWireframe = usePersonalWireframe(data.activityCount, 8);
  const wf = WIREFRAME_OVERVIEW_KPIS;

  const kpis = useWireframe
    ? wf
    : {
        totalNumbers: data.kpis.totalNumbers,
        totalNumbersDelta: data.kpis.totalNumbersDelta,
        voicemails: data.kpis.voicemails,
        voicemailsTrendPct: data.kpis.voicemailsTrendPct,
        transcriptions: data.kpis.transcriptions,
        transcriptionsTrendPct: data.kpis.transcriptionsTrendPct,
        calls30d: data.kpis.calls30d,
        callsTrendPct: data.kpis.callsTrendPct,
        walletBalance: `$${data.kpis.walletBalance.toFixed(2)}`,
        walletTrendPct: data.kpis.walletTrendPct,
        blockedNumbers: data.kpis.blockedNumbers,
        blockedDelta: data.kpis.blockedDelta,
        walletAutoTopup: data.kpis.walletAutoTopup,
      };

  const walletDisplay =
    typeof kpis.walletBalance === "string"
      ? kpis.walletBalance
      : `$${Number(kpis.walletBalance).toFixed(2)}`;

  const topNumbers = useWireframe ? WIREFRAME_OVERVIEW_TOP_NUMBERS : data.topNumbers;
  const timeline = useWireframe ? WIREFRAME_OVERVIEW_TIMELINE : data.timeline;
  const topDestinations = useWireframe
    ? WIREFRAME_OVERVIEW_TOP_DESTINATIONS
    : data.topDestinations;
  const pendingTransfers = useWireframe
    ? WIREFRAME_OVERVIEW_PENDING_TRANSFERS
    : data.pendingTransfers;
  const recentNumbers = useWireframe ? WIREFRAME_OVERVIEW_RECENT_NUMBERS : data.recentNumbers;
  const billingHistory = useWireframe
    ? WIREFRAME_OVERVIEW_BILLING_HISTORY
    : data.billingHistory;
  const recentVoicemail = useWireframe
    ? WIREFRAME_OVERVIEW_RECENT_VOICEMAIL
    : data.recentVoicemail;
  const topCallNumbers = useWireframe
    ? WIREFRAME_OVERVIEW_TOP_CALL_NUMBERS
    : data.topCallNumbers;

  return (
    <PersonalMockPage>
      <PersonalMockHeader
        title="Overview"
        description="Manage your calls and view your numbers at a glance."
        actions={
          <>
            <Link href="/personal/numbers/premium">
              <PersonalMockBtn>
                <Plus className="h-4 w-4" />
                Create a new number
              </PersonalMockBtn>
            </Link>
            <button
              type="button"
              className="text-[13px] font-semibold text-[#6366f1] hover:underline"
            >
              Edit dashboard
            </button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <PersonalMockKpi
          label="Total Numbers"
          value={kpis.totalNumbers}
          sub={kpis.totalNumbersDelta}
          icon={Phone}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
        <PersonalMockKpi
          label="Voicemails"
          value={kpis.voicemails}
          trend={kpis.voicemailsTrendPct}
          trendLabel=""
          icon={MessageSquare}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
        <PersonalMockKpi
          label="Transcriptions"
          value={kpis.transcriptions}
          trend={kpis.transcriptionsTrendPct}
          trendLabel=""
          icon={Mic}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalMockKpi
          label="Calls"
          value={kpis.calls30d}
          trend={kpis.callsTrendPct}
          trendLabel=""
          icon={PhoneCall}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
        <PersonalMockKpi
          label="Wallet Balance"
          value={walletDisplay}
          trend={kpis.walletTrendPct}
          trendLabel=""
          icon={Wallet}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalMockKpi
          label="Blocked Numbers"
          value={kpis.blockedNumbers}
          sub={kpis.blockedDelta}
          icon={AlertTriangle}
          iconClass="bg-[#fef2f2] text-[#dc2626]"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <PersonalMockSection
          title="Top Numbers"
          description="Manage your top active numbers"
          action={
            <div className="flex items-center gap-2">
              <PersonalMockSelect className="h-8 w-[110px] text-[12px]">
                <option>Show 30 rows</option>
                <option>Show 10 rows</option>
                <option>Show 50 rows</option>
              </PersonalMockSelect>
              <PersonalMockSelect className="h-8 w-[90px] text-[12px]">
                <option>30 days</option>
                <option>7 days</option>
                <option>90 days</option>
              </PersonalMockSelect>
            </div>
          }
        >
          {topNumbers.length === 0 ? (
            <p className={pm.muted}>No numbers yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[920px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                      <th className="pb-3 pr-3 w-8">
                        <input type="checkbox" className="rounded border-[#d1d5db]" aria-label="Select all" />
                      </th>
                      <th className="pb-3 pr-3">Label</th>
                      <th className="pb-3 pr-3">Phone Number</th>
                      <th className="pb-3 pr-3">Type</th>
                      <th className="pb-3 pr-3">Forwarding</th>
                      <th className="pb-3 pr-3">Status</th>
                      <th className="pb-3 pr-3 w-10">Action</th>
                      <th className="pb-3 pr-3">Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f3f4f6]">
                    {topNumbers.map((row) => (
                      <tr key={row.id}>
                        <td className="py-3 pr-3">
                          <input type="checkbox" className="rounded border-[#d1d5db]" aria-label={`Select ${row.label}`} />
                        </td>
                        <td className="py-3 pr-3 font-semibold text-[#111827]">{row.label}</td>
                        <td className="py-3 pr-3 text-[#374151]">{formatPhone(row.phone)}</td>
                        <td className="py-3 pr-3 text-[#6b7280]">{row.type}</td>
                        <td className="py-3 pr-3 text-[#6b7280]">
                          {row.forwarding === "—" ? "—" : formatPhone(row.forwarding)}
                        </td>
                        <td className="py-3 pr-3">
                          <PersonalMockPill tone={row.statusTone}>{row.status}</PersonalMockPill>
                        </td>
                        <td className="py-3 pr-3">
                          <button
                            type="button"
                            className="rounded p-1 text-[#9ca3af] hover:bg-[#f3f4f6] hover:text-[#374151]"
                            aria-label="Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </td>
                        <td className="py-3 pr-3">
                          <PersonalMockSparkline
                            points={row.activitySparkline}
                            color="#059669"
                            width={72}
                            height={28}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Link
                href="/personal/numbers"
                className="mt-4 inline-block text-[13px] font-semibold text-[#6366f1] hover:underline"
              >
                View all numbers →
              </Link>
            </>
          )}
        </PersonalMockSection>

        <div className="space-y-4">
          <PersonalMockSection title="Quick Menu">
            <ul className="space-y-1 text-[13px]">
              {QUICK_MENU.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 font-medium text-[#374151] hover:bg-[#f9fafb]"
                  >
                    <item.icon className="h-4 w-4 text-[#9ca3af]" strokeWidth={2} />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </PersonalMockSection>

          <PersonalMockSection title="Quick Actions">
            <ul className="space-y-2 text-[13px]">
              {QUICK_ACTIONS.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[#374151] hover:bg-[#f9fafb]"
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      readOnly
                      className="rounded border-[#d1d5db]"
                      aria-hidden
                    />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </PersonalMockSection>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <PersonalMockSection title="Timeline">
          <ul className="space-y-3 text-[13px]">
            {timeline.length === 0 ? (
              <li className={pm.muted}>No recent events.</li>
            ) : (
              timeline.map((row) => (
                <li key={row.id} className="flex gap-3">
                  <span className="shrink-0 text-[11px] font-semibold text-[#9ca3af] w-16">
                    {row.date}
                  </span>
                  <span className="text-[#374151]">{row.label}</span>
                </li>
              ))
            )}
          </ul>
          <WidgetFooterLink href="/personal/activity" label="View all activity →" />
        </PersonalMockSection>

        <PersonalMockSection title="Wallet balance">
          <p className="text-[28px] font-bold text-[#111827]">{walletDisplay}</p>
          <p className="mt-1 text-[12px] text-[#6b7280]">
            {kpis.walletAutoTopup ? "Auto-topup active" : "Auto-topup off"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/settings/billing">
              <PersonalMockBtn>Add funds</PersonalMockBtn>
            </Link>
          </div>
          <WidgetFooterLink href="/settings/billing" label="View history" />
        </PersonalMockSection>

        <PersonalMockSection title="Top Destinations">
          {topDestinations.length === 0 ? (
            <p className={pm.muted}>No destination data yet.</p>
          ) : (
            <ul className="space-y-3 text-[13px]">
              {topDestinations.map((row, i) => (
                <li key={`${row.phone}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-medium text-[#111827]">
                    <span className="text-[12px] text-[#9ca3af]" aria-hidden>+1</span>
                    {formatPhone(row.phone)}
                  </span>
                  <span className="text-[11px] text-[#9ca3af]">{row.date}</span>
                  <span className="font-semibold tabular-nums text-[#111827]">{row.duration}</span>
                </li>
              ))}
            </ul>
          )}
          <WidgetFooterLink href="/personal/analytics" label="View all destinations →" />
        </PersonalMockSection>

        <PersonalMockSection title="Pending Transfers">
          {pendingTransfers.length === 0 ? (
            <p className={pm.muted}>No pending transfers.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="pb-2 pr-2">To/From</th>
                  <th className="pb-2 pr-2">Started</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {pendingTransfers.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2 pr-2 text-[#374151]">{row.toFrom}</td>
                    <td className="py-2 pr-2 text-[#9ca3af]">{row.started}</td>
                    <td className="py-2">
                      <PersonalMockPill tone={row.statusTone}>{row.status}</PersonalMockPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <WidgetFooterLink href="/personal/porting" label="View all transfers →" />
        </PersonalMockSection>

        <PersonalMockSection title="Recent Numbers">
          {recentNumbers.length === 0 ? (
            <p className={pm.muted}>No numbers yet.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="pb-2 pr-2">Number</th>
                  <th className="pb-2 pr-2">Forwarding</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {recentNumbers.map((row, i) => (
                  <tr key={`${row.phone}-${i}`}>
                    <td className="py-2 pr-2 font-medium text-[#111827]">
                      {formatPhone(row.phone)}
                    </td>
                    <td className="py-2 pr-2 text-[#6b7280]">
                      {row.forwarding === "—" || row.forwarding === "On"
                        ? row.forwarding
                        : formatPhone(row.forwarding)}
                    </td>
                    <td className="py-2">
                      <PersonalMockPill tone={row.statusTone}>{row.status}</PersonalMockPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <WidgetFooterLink href="/personal/numbers" label="View all numbers →" />
        </PersonalMockSection>

        <PersonalMockSection title="Billing History">
          {billingHistory.length === 0 ? (
            <p className={pm.muted}>No billing history yet.</p>
          ) : (
            <ul className="space-y-2 text-[13px]">
              {billingHistory.map((row, i) => (
                <li key={`${row.date}-${i}`} className="flex justify-between gap-2">
                  <span className="text-[#374151]">{row.date}</span>
                  <span className="font-semibold text-[#111827]">{row.amount}</span>
                </li>
              ))}
            </ul>
          )}
          <WidgetFooterLink href="/settings/billing" label="View all billing →" />
        </PersonalMockSection>

        <PersonalMockSection title="Recent Voicemail">
          {recentVoicemail.length === 0 ? (
            <p className={pm.muted}>No voicemails yet.</p>
          ) : (
            <ul className="space-y-3 text-[13px]">
              {recentVoicemail.map((row) => (
                <li key={row.id}>
                  <p className="font-semibold text-[#111827]">{row.name}</p>
                  <p className="text-[12px] text-[#6b7280]">
                    {formatPhone(row.phone)} · {row.at}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <WidgetFooterLink href="/personal/voicemail" label="View all voicemail →" />
        </PersonalMockSection>

        <PersonalMockSection title="Top Call Numbers">
          {topCallNumbers.length === 0 ? (
            <p className={pm.muted}>No call volume yet.</p>
          ) : (
            <PersonalMockBarChart items={topCallNumbers} barClass="bg-[#6366f1]" />
          )}
          <WidgetFooterLink href="/personal/analytics" label="View analytics →" />
        </PersonalMockSection>
      </div>
    </PersonalMockPage>
  );
}
