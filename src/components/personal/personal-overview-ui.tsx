"use client";

import type { PersonalOverviewActivityRow, PersonalNumberRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import {
  ArrowRight,
  Forward,
  Phone,
  PhoneForwarded,
  Search,
  Voicemail,
} from "lucide-react";
import Link from "next/link";
import {
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalSection,
  PersonalStatCard,
  PersonalStatusBadge,
  pCard,
  pMuted,
} from "./personal-ui";

type PortRow = {
  id: string;
  phone: string;
  status: string;
  statusLabel?: string;
};

export function PersonalOverviewUI({
  userName,
  numbers,
  activity,
  premiumCartCount = 0,
  portRequests,
}: {
  userName: string;
  numbers: PersonalNumberRow[];
  activity: PersonalOverviewActivityRow[];
  premiumCartCount?: number;
  portRequests: PortRow[];
}) {
  const activeCount = numbers.filter((n) => n.serviceState !== "PARKED").length;
  const forwardingCount = numbers.filter((n) => n.voiceForwardTo).length;
  const voicemailCount = numbers.filter((n) => n.voicemailEnabled).length;
  const portingCount = portRequests.filter((p) => p.status !== "completed" && p.status !== "cancelled").length;
  const activePort = portRequests[0];

  const portSteps = ["Submitted", "In Progress", "Scheduled", "Completed"];
  const portIndex = activePort
    ? Math.min(
        portSteps.length - 1,
        ["pending", "docs_needed", "submitted", "in_progress", "foc_confirmed", "completed"].indexOf(
          activePort.status,
        ),
      )
    : 0;

  return (
    <PersonalPageWrap>
      <PersonalPageHeader
        title="Overview"
        description={`You're in the personal side of Transovo today, ${userName.split(" ")[0] || "there"}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <PersonalStatCard
          label="My Numbers"
          value={activeCount}
          sub="active"
          icon={Phone}
          href="/personal/numbers"
          hrefLabel="View all ›"
        />
        <PersonalStatCard
          label="Find a Number"
          value={premiumCartCount}
          sub="in your cart"
          icon={Search}
          iconClass="bg-[#ecfdf5] text-[#059669]"
          href="/personal/numbers/premium"
          hrefLabel="View cart ›"
        />
        <PersonalStatCard
          label="Forwarding"
          value={forwardingCount}
          sub="active"
          icon={PhoneForwarded}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
          href="/personal/forwarding"
          hrefLabel="Manage ›"
        />
        <PersonalStatCard
          label="Voicemail"
          value={voicemailCount}
          sub={`${voicemailCount} enabled`}
          icon={Voicemail}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
          href="/personal/voicemail"
          hrefLabel="View ›"
        />
        <PersonalStatCard
          label="Porting"
          value={portingCount}
          sub="in progress"
          icon={Forward}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
          href="/personal/porting"
          hrefLabel="View status ›"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PersonalSection
          title="My Numbers at a Glance"
          description="What each number is doing right now."
        >
          {numbers.length === 0 ? (
            <p className={pMuted}>You don&apos;t have a number yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    <th className="pb-3 pr-4">Number</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4">Current action</th>
                    <th className="pb-3 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {numbers.slice(0, 5).map((n) => (
                    <tr key={n.id}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-[#111827]">{formatPhone(n.number)}</p>
                        <p className="text-[11px] text-[#9ca3af]">{n.friendlyName || n.areaCode}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <PersonalStatusBadge
                          status={
                            n.serviceState === "PARKED" ? "inactive" : "active"
                          }
                        />
                      </td>
                      <td className="py-3 pr-4 text-[#6b7280]">
                        {n.voiceForwardTo
                          ? `Forwarded to ${formatPhone(n.voiceForwardTo)}`
                          : n.serviceLabel}
                      </td>
                      <td className="py-3 text-right font-medium text-[#111827]">
                        ${n.monthlyCost.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Link
            href="/personal/numbers/premium"
            className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-[#e5e7eb] px-4 py-3 text-[13px] font-medium text-[#6366f1] hover:bg-[#f9fafb]"
          >
            + Add Another Number — buy, rent, or port a new number now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </PersonalSection>

        <PersonalSection title="Porting Status" description="Track numbers moving to or from Transovo.">
          {activePort ? (
            <div>
              <p className="text-[15px] font-semibold text-[#111827]">{formatPhone(activePort.phone)}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                {portSteps.map((step, i) => (
                  <div key={step} className="flex flex-1 flex-col items-center text-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold ${
                        i <= portIndex
                          ? "bg-[#6366f1] text-white"
                          : "bg-[#f3f4f6] text-[#9ca3af]"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <p className="mt-2 text-[10px] font-medium text-[#374151]">{step}</p>
                  </div>
                ))}
              </div>
              <Link
                href="/personal/porting"
                className="mt-4 inline-block text-[13px] font-semibold text-[#6366f1]"
              >
                View Porting Details
              </Link>
            </div>
          ) : (
            <p className={pMuted}>No active port requests.</p>
          )}
        </PersonalSection>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PersonalSection title="Recent Activity">
          {activity.length === 0 ? (
            <p className={pMuted}>No recent activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.slice(0, 4).map((row) => (
                <li key={row.id} className="flex gap-3 text-[13px]">
                  <span className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-[#f3f4f6] flex items-center justify-center text-[#6366f1]">
                    <Phone className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[#111827]">{row.summary}</p>
                    <p className="text-[11px] text-[#9ca3af]">
                      {new Date(row.at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/personal/numbers" className="mt-4 text-[13px] font-semibold text-[#6366f1]">
            View all activity ›
          </Link>
        </PersonalSection>

        <PersonalSection title="Quick Actions">
          <ul className="space-y-2">
            {[
              {
                title: "Find a New Number",
                desc: "Search and buy the perfect number",
                href: "/personal/numbers/premium",
              },
              {
                title: "Start a New Port",
                desc: "Bring your number from another carrier",
                href: "/personal/porting",
              },
              {
                title: "Set Up Call Forwarding",
                desc: "Route calls to any phone",
                href: "/personal/forwarding",
              },
              {
                title: "Check Voicemail",
                desc: "Listen to and manage messages",
                href: "/personal/voicemail",
              },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-[#f3f4f6] px-4 py-3 hover:bg-[#f9fafb]"
              >
                <div>
                  <p className="text-[13px] font-semibold text-[#111827]">{item.title}</p>
                  <p className="text-[12px] text-[#6b7280]">{item.desc}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-[#9ca3af]" />
              </Link>
            ))}
          </ul>
        </PersonalSection>
      </div>
    </PersonalPageWrap>
  );
}
