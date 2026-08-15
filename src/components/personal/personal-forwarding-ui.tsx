"use client";

import type { PhoneNumber } from "@/lib/types";
import { formatPhone } from "@/lib/utils";
import {
  ArrowRight,
  Clock,
  Cloud,
  HelpCircle,
  Phone,
  PhoneForwarded,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PersonalAsideCard,
  PersonalOutlineButton,
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalPrimaryButton,
  PersonalSection,
  PersonalStatCard,
  PersonalStatusBadge,
  pMuted,
} from "./personal-ui";

type ForwardingRule = {
  id: string;
  phoneNumberId: string | null;
  targetValue: string;
  active: boolean;
};

type ActivityRow = { id: string; from: string; to: string; at: string };

export function PersonalForwardingUI({
  numbers,
  initialNumberId,
}: {
  numbers: PhoneNumber[];
  initialNumberId?: string;
}) {
  const [_rules, setRules] = useState<ForwardingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState(initialNumberId || numbers[0]?.id || "");
  const [destination, setDestination] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/phone/forwarding")
      .then((r) => r.json())
      .then((j) => setRules(j.data || []))
      .finally(() => setLoading(false));
  }, []);

  const selected = numbers.find((n) => n.id === editId);
  useEffect(() => {
    if (selected?.voiceForwardTo) setDestination(selected.voiceForwardTo);
  }, [selected]);

  const activeRules = numbers.filter((n) => n.voiceForwardTo).length;
  const primaryDest = numbers.find((n) => n.voiceForwardTo)?.voiceForwardTo;

  const rows = numbers.filter((n) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return formatPhone(n.number).toLowerCase().includes(q) || n.friendlyName?.toLowerCase().includes(q);
  });

  const activity: ActivityRow[] = numbers
    .filter((n) => n.voiceForwardTo)
    .slice(0, 3)
    .map((n) => ({
      id: n.id,
      from: formatPhone(n.number),
      to: formatPhone(n.voiceForwardTo!),
      at: "Today",
    }));

  async function save() {
    setMessage(null);
    try {
      await fetch("/api/phone/forwarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumberId: editId,
          targetType: "external",
          targetValue: destination,
          mode: "always",
          active: enabled,
          ringSeconds: 25,
        }),
      });
      await fetch(`/api/numbers/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceForwardTo: enabled ? destination : null }),
      });
      setMessage("Forwarding saved.");
    } catch {
      setMessage("Could not save forwarding.");
    }
  }

  return (
    <PersonalPageWrap
      aside={
        <>
          <PersonalAsideCard title="Forwarding Quick Tips">
            <ul className="space-y-4">
              {[
                {
                  icon: PhoneForwarded,
                  title: "Universal Forward",
                  text: "Set one primary number to receive all calls from your Transovo lines.",
                },
                {
                  icon: Clock,
                  title: "Smart Business Routing",
                  text: "During work hours, forward to your office. After hours, send to voicemail.",
                },
                {
                  icon: Shield,
                  title: "Safe and Secure",
                  text: "Your private numbers are never exposed to callers.",
                },
              ].map((tip) => (
                <li key={tip.title} className="flex gap-2">
                  <tip.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]" />
                  <div>
                    <p className="font-semibold text-[#111827]">{tip.title}</p>
                    <p>{tip.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </PersonalAsideCard>
          <PersonalAsideCard title="Quick Help">
            <ul className="space-y-2">
              <li><Link href="/personal/forwarding" className="text-[#6366f1]">How it works</Link></li>
              <li><Link href="/personal/porting" className="text-[#6366f1]">Port a Number</Link></li>
              <li><Link href="/contact" className="text-[#6366f1]">Get Help</Link></li>
              <li><Link href="/contact" className="text-[#6366f1]">Feedback</Link></li>
            </ul>
          </PersonalAsideCard>
        </>
      }
    >
      <PersonalPageHeader
        title="Call Forwarding"
        description="Manage how and where you receive incoming calls for your phone numbers."
        actions={
          <>
            <PersonalPrimaryButton className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add New Rule
            </PersonalPrimaryButton>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9ca3af]" />
              <input
                className="h-9 w-52 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] pl-9 pr-3 text-[13px] outline-none focus:border-[#6366f1]"
                placeholder="Search Forwarding Rules"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PersonalStatCard
          label="Active Forwarding"
          value={activeRules}
          icon={Phone}
        />
        <PersonalStatCard
          label="Primary Destination"
          value={primaryDest ? formatPhone(primaryDest) : "—"}
          sub="Mobile Phone"
          icon={PhoneForwarded}
          iconClass="bg-[#ecfdf5] text-[#059669]"
        />
        <PersonalStatCard
          label="Total Forwarded This Month"
          value={activity.length}
          sub="Calls forwarded"
          icon={Cloud}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
        <PersonalStatCard
          label="Next Scheduled Forward"
          value="Always"
          sub="No schedule set"
          icon={Clock}
          iconClass="bg-[#fff7ed] text-[#ea580c]"
        />
      </div>

      <PersonalSection
        title="Forwarding Numbers"
        description="Choose where calls should be forwarded and how they are handled."
      >
        {loading ? (
          <p className={pMuted}>Loading…</p>
        ) : numbers.length === 0 ? (
          <p className={pMuted}>
            No numbers yet.{" "}
            <Link href="/personal/numbers/premium" className="text-[#6366f1]">Find a number</Link>
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                    <th className="pb-3 pr-3">Phone number</th>
                    <th className="pb-3 pr-3">Type</th>
                    <th className="pb-3 pr-3">Forward to</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Schedule</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f3f4f6]">
                  {rows.map((n) => (
                    <tr key={n.id}>
                      <td className="py-3 pr-3">
                        <p className="font-semibold">{formatPhone(n.number)}</p>
                        <p className="text-[11px] text-[#9ca3af]">{n.friendlyName || "Personal"}</p>
                      </td>
                      <td className="py-3 pr-3 text-[#6b7280]">
                        {n.voiceForwardTo ? "Forwarding" : "Ring"}
                      </td>
                      <td className="py-3 pr-3">
                        {n.voiceForwardTo ? formatPhone(n.voiceForwardTo) : "None"}
                      </td>
                      <td className="py-3 pr-3">
                        <PersonalStatusBadge
                          status={n.voiceForwardTo ? "active" : "inactive"}
                        />
                      </td>
                      <td className="py-3 pr-3 text-[#6b7280] flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Always
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEditId(n.id)}
                          className="text-[12px] font-semibold text-[#6366f1]"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-lg border border-[#e5e7eb] bg-[#f9fafb] p-4">
              <p className="text-[13px] font-semibold text-[#111827]">Edit forwarding rule</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select
                  className="h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[13px]"
                  value={editId}
                  onChange={(e) => setEditId(e.target.value)}
                >
                  {numbers.map((n) => (
                    <option key={n.id} value={n.id}>{formatPhone(n.number)}</option>
                  ))}
                </select>
                <input
                  className="h-10 rounded-lg border border-[#e5e7eb] bg-white px-3 text-[13px]"
                  placeholder="Forward to number"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
              <label className="mt-3 flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Active forwarding
              </label>
              <div className="mt-4 flex gap-2">
                <PersonalPrimaryButton onClick={save}>Save Changes</PersonalPrimaryButton>
                <PersonalOutlineButton type="button">Add another line</PersonalOutlineButton>
              </div>
              {message ? <p className="mt-2 text-[12px] text-[#6b7280]">{message}</p> : null}
            </div>
          </>
        )}
      </PersonalSection>

      <PersonalSection title="Recent Forwarding Activity">
        {activity.length === 0 ? (
          <p className={pMuted}>No forwarding activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 text-[13px]">
                <ArrowRight className="h-4 w-4 text-[#6366f1]" />
                <span className="text-[#111827]">{a.from}</span>
                <ArrowRight className="h-3 w-3 text-[#9ca3af]" />
                <span className="text-[#6b7280]">{a.to}</span>
                <span className="ml-auto text-[11px] text-[#9ca3af]">{a.at}</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="mt-3 text-[13px] font-semibold text-[#6366f1]">
          View All Activity
        </button>
      </PersonalSection>
    </PersonalPageWrap>
  );
}
