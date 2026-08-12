"use client";

import {
  ACTIVE_CALL,
  DIALER_LINE,
  DIALER_NUMBERS,
  RECENT_CALLS,
  RECENT_CONTACTS,
  RECENT_DELIVERIES,
  VOICEMAIL_PREVIEW,
} from "@/lib/realtor/dialer-crm-mock";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Grid3X3,
  MessageSquare,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Play,
  Plus,
  Settings,
  UserPlus,
  Voicemail,
} from "lucide-react";
import { useState } from "react";
import { CrmPageTabs } from "../shared/crm-page-tabs";

const DIALER_TABS = ["Dialer", "Recent Calls", "Numbers"];
const KEYPAD = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

function DirectionIcon({ direction }: { direction: string }) {
  if (direction === "inbound") return <PhoneIncoming className="h-4 w-4 text-emerald-600" />;
  if (direction === "missed") return <PhoneMissed className="h-4 w-4 text-red-500" />;
  return <PhoneOutgoing className="h-4 w-4 text-blue-600" />;
}

export function DialerView() {
  const [tab, setTab] = useState("Dialer");
  const [digits, setDigits] = useState("");
  const [holdActive, setHoldActive] = useState(true);

  const appendDigit = (d: string) => setDigits((prev) => prev + d);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">Dialer</h1>
          <p className="mt-1 text-[15px] text-[#6b7280]">Make and receive calls from your desktop app.</p>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[#6b7280]">
          <span>Line: <strong className="text-[#111827]">{DIALER_LINE}</strong></span>
          <Settings className="h-4 w-4 cursor-pointer hover:text-[#111827]" />
        </div>
      </div>

      <CrmPageTabs tabs={DIALER_TABS} active={tab} onChange={setTab} accent="#2563eb" />

      {tab === "Dialer" ? (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr_260px]">
          <div className="realtor-card p-4">
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-[20px] font-bold text-purple-700">
                {ACTIVE_CALL.initials}
              </span>
              <h3 className="mt-3 text-[18px] font-bold">{ACTIVE_CALL.name}</h3>
              <span className="mt-1 inline-block rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">{ACTIVE_CALL.badge}</span>
              <p className="mt-2 text-[12px] text-[#6b7280]">{ACTIVE_CALL.since}</p>
              <p className="text-[12px] text-[#6b7280]">{ACTIVE_CALL.location}</p>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { label: "Mute", icon: MicOff },
                { label: "Keypad", icon: Grid3X3 },
                { label: "Add Call", icon: UserPlus },
                { label: "Hold", icon: Pause, active: holdActive, onClick: () => setHoldActive(!holdActive) },
                { label: "Record", icon: Mic },
                { label: "Transfer", icon: PhoneForwarded },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-3 text-[11px] font-semibold transition",
                    action.active ? "border-[#7c3aed] bg-purple-50 text-[#7c3aed]" : "border-[#e5e7eb] hover:bg-[#f9fafb]",
                  )}
                >
                  <action.icon className="h-5 w-5" />
                  {action.label}
                </button>
              ))}
            </div>
            <button type="button" className="mt-4 w-full rounded-xl bg-red-500 py-3 text-[14px] font-bold text-white hover:bg-red-600">
              End Call
            </button>
          </div>

          <div className="realtor-card p-6">
            <div className="mx-auto max-w-xs">
              <div className="mb-6 flex items-center gap-2 rounded-xl border border-[#e5e7eb] px-4 py-3">
                <span className="text-lg">🇺🇸</span>
                <input
                  value={digits}
                  onChange={(e) => setDigits(e.target.value)}
                  placeholder="Enter number or search"
                  className="flex-1 bg-transparent text-[18px] font-medium outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {KEYPAD.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => appendDigit(key)}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f3f4f6] text-[20px] font-semibold text-[#111827] transition hover:bg-[#e5e7eb] mx-auto"
                  >
                    {key}
                  </button>
                ))}
              </div>
              <button type="button" className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg hover:bg-emerald-600">
                <Phone className="h-7 w-7" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="realtor-card p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-[#6b7280]">Shortcuts</h3>
              <ul className="mt-3 space-y-2">
                {["Send Text Message", "Log a Call"].map((item) => (
                  <li key={item}>
                    <button type="button" className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-[13px] hover:bg-[#f9fafb]">
                      {item}
                      <ChevronRight className="h-4 w-4 text-[#9ca3af]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="realtor-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[#111827]">Recent Contacts</h3>
                <button type="button" className="text-[12px] font-semibold text-[#2563eb]">See All</button>
              </div>
              <ul className="mt-3 space-y-2">
                {RECENT_CONTACTS.map((c) => (
                  <li key={c.name} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-[#f9fafb]">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700">{c.initials}</span>
                    <span className="flex-1 text-[13px] font-medium">{c.name}</span>
                    {c.type === "sms" ? <MessageSquare className="h-4 w-4 text-[#6b7280]" /> : c.type === "missed" ? <PhoneMissed className="h-4 w-4 text-red-500" /> : <Phone className="h-4 w-4 text-[#6b7280]" />}
                  </li>
                ))}
              </ul>
            </div>

            <div className="realtor-card p-4">
              <h3 className="font-semibold text-[#111827]">Voicemail</h3>
              <p className="text-[12px] text-[#6b7280]">From {VOICEMAIL_PREVIEW.from}</p>
              <div className="mt-3 flex items-center gap-3">
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7c3aed] text-white">
                  <Play className="h-4 w-4" />
                </button>
                <div className="flex-1">
                  <div className="flex h-6 items-end gap-0.5">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div key={i} className="w-1 rounded-full bg-[#7c3aed]" style={{ height: `${8 + Math.sin(i) * 12 + 8}px` }} />
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-[#9ca3af]">{VOICEMAIL_PREVIEW.current} / {VOICEMAIL_PREVIEW.duration}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : tab === "Recent Calls" ? (
        <div className="realtor-card overflow-hidden">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[#f9fafb] text-[11px] font-semibold uppercase text-[#6b7280]">
              <tr>
                <th className="px-4 py-2">Contact</th>
                <th className="px-4 py-2">Phone</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Direction</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e5e7eb]">
              {RECENT_CALLS.map((call) => (
                <tr key={call.id} className="hover:bg-[#f9fafb]">
                  <td className="px-4 py-3 font-semibold">{call.contact}</td>
                  <td className="px-4 py-3 text-[#6b7280]">{call.phone}</td>
                  <td className="px-4 py-3 text-[#6b7280]">{call.time}</td>
                  <td className="px-4 py-3">{call.duration}</td>
                  <td className="px-4 py-3"><DirectionIcon direction={call.direction} /></td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", call.status === "Missed" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                      {call.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" className="text-[#2563eb] hover:underline">Call back</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button type="button" className="realtor-btn-primary">
              <Plus className="h-4 w-4" />
              Add Number
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DIALER_NUMBERS.map((num) => (
              <div key={num.id} className={cn("realtor-card p-4", num.default && "ring-2 ring-[#2563eb]")}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[18px] font-bold text-[#111827]">{num.number}</p>
                    <p className="text-[13px] text-[#6b7280]">{num.label}</p>
                  </div>
                  {num.default ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Default</span> : null}
                </div>
                <p className="mt-2 text-[12px] text-[#9ca3af]">{num.type}</p>
                <div className="mt-4 flex gap-2">
                  <button type="button" className="realtor-btn-outline flex-1 text-[12px]">Set Default</button>
                  <button type="button" className="realtor-btn-primary flex-1 text-[12px]">
                    <PhoneCall className="h-3.5 w-3.5" />
                    Call
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "Dialer" ? (
        <div>
          <h3 className="mb-3 font-semibold text-[#111827]">Recent Deliveries</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {RECENT_DELIVERIES.map((d) => (
              <div key={d.contact + d.time} className="realtor-card flex items-center gap-3 p-4">
                {d.direction === "inbound" ? <PhoneIncoming className="h-5 w-5 text-emerald-600" /> : d.direction === "missed" ? <PhoneMissed className="h-5 w-5 text-red-500" /> : <PhoneOutgoing className="h-5 w-5 text-blue-600" />}
                <div>
                  <p className="text-[13px] font-semibold">{d.type}</p>
                  <p className="text-[12px] text-[#6b7280]">{d.contact} · {d.time}</p>
                  <p className="text-[11px] text-[#9ca3af]">{d.duration}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
