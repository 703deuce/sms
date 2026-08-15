"use client";

import {
  Archive,
  Cloud,
  Folder,
  HelpCircle,
  Mic,
  Phone,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, Fragment } from "react";
import { formatPhone } from "@/lib/utils";
import {
  PersonalAsideCard,
  PersonalOutlineButton,
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalPrimaryButton,
  PersonalSection,
  PersonalStatCard,
  PersonalStatusBadge,
  pCard,
  pMuted,
} from "./personal-ui";

type VoicemailMessage = {
  id: string;
  callerNumber: string;
  durationSec: number;
  createdAt: string;
  transcript?: string | null;
  readAt?: string | null;
};

export function PersonalVoicemailUI({ numberId }: { numberId?: string }) {
  const [messages, setMessages] = useState<VoicemailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoTranscription, setAutoTranscription] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [forwardEmail, setForwardEmail] = useState("");

  useEffect(() => {
    fetch("/api/phone/voicemail")
      .then((r) => r.json())
      .then((j) => {
        const boxes = j.data || [];
        const all: VoicemailMessage[] = [];
        for (const box of boxes) {
          for (const m of box.messages || []) {
            all.push(m);
          }
        }
        setMessages(all);
        if (all[0]) setExpandedId(all[0].id);
      })
      .finally(() => setLoading(false));
  }, [numberId]);

  const unread = messages.filter((m) => !m.readAt).length;
  const totalGreetings = 4;

  return (
    <PersonalPageWrap
      aside={
        <>
          <PersonalAsideCard title="How to use Voicemail">
            <ul className="space-y-3">
              {[
                "Callers hear your greeting when you can’t answer.",
                "Messages appear here with optional transcription.",
                "Forward important voicemails to your email.",
              ].map((text) => (
                <li key={text} className="flex gap-2">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#6366f1]" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </PersonalAsideCard>
          <PersonalAsideCard title="Quick Tips">
            <p>Keep greetings short and mention when you&apos;ll call back.</p>
            <p className="mt-2">Turn on email alerts so you never miss an important message.</p>
          </PersonalAsideCard>
          <div className={pCard + " p-4 text-center"}>
            <p className="text-[13px] font-semibold text-[#111827]">Storage</p>
            <div className="mx-auto mt-3 flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#6366f1] text-[14px] font-bold text-[#6366f1]">
              50%
            </div>
            <p className="mt-2 text-[12px] text-[#6b7280]">2.5 GB of 5 GB used</p>
            <Link href="/settings/billing" className="mt-2 text-[12px] font-semibold text-[#6366f1]">
              Upgrade to Pro
            </Link>
          </div>
        </>
      }
    >
      <PersonalPageHeader
        title="Voicemail"
        description="Manage your voicemails, greetings, and transcriptions for your numbers."
        actions={
          <>
            <PersonalOutlineButton className="gap-1.5">
              <Upload className="h-4 w-4" />
              Upload Greeting
            </PersonalOutlineButton>
            <PersonalPrimaryButton className="gap-1.5">
              <Mic className="h-4 w-4" />
              Create Greeting
            </PersonalPrimaryButton>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PersonalStatCard label="Total Voicemails" value={messages.length} icon={Folder} />
        <PersonalStatCard
          label="Unread Messages"
          value={unread}
          icon={Phone}
          iconClass="bg-[#fef2f2] text-[#dc2626]"
        />
        <PersonalStatCard
          label="Storage Used"
          value="2.5 GB"
          sub="of 5 GB"
          icon={Cloud}
          iconClass="bg-[#eff6ff] text-[#2563eb]"
        />
        <PersonalStatCard
          label="Total Greetings"
          value={totalGreetings}
          icon={Mic}
          iconClass="bg-[#f5f3ff] text-[#7c3aed]"
        />
      </div>

      <PersonalSection title="Voicemail Inbox">
        {loading ? (
          <p className={pMuted}>Loading voicemail…</p>
        ) : messages.length === 0 ? (
          <div className="py-10 text-center">
            <p className={pMuted}>No voicemails yet.</p>
            <p className="mt-1 text-[12px] text-[#9ca3af]">
              When someone leaves a message, it will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af]">
                  <th className="pb-3 w-8" />
                  <th className="pb-3 pr-3">Name</th>
                  <th className="pb-3 pr-3">Number</th>
                  <th className="pb-3 pr-3">Date</th>
                  <th className="pb-3 pr-3">Duration</th>
                  <th className="pb-3 pr-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => {
                  const expanded = expandedId === m.id;
                  return (
                    <Fragment key={m.id}>
                      <tr
                        className="border-b border-[#f3f4f6] cursor-pointer hover:bg-[#f9fafb]"
                        onClick={() => setExpandedId(expanded ? null : m.id)}
                      >
                        <td className="py-3">
                          <input type="checkbox" readOnly className="rounded" />
                        </td>
                        <td className="py-3 pr-3 font-medium text-[#111827]">Caller</td>
                        <td className="py-3 pr-3">{formatPhone(m.callerNumber || "Unknown")}</td>
                        <td className="py-3 pr-3 text-[#6b7280]">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 pr-3">{m.durationSec}s</td>
                        <td className="py-3 pr-3">
                          <PersonalStatusBadge status={m.readAt ? "neutral" : "new"} />
                        </td>
                        <td className="py-3 text-right text-[#9ca3af]">⋯</td>
                      </tr>
                      {expanded ? (
                        <tr className="bg-[#f9fafb]">
                          <td colSpan={7} className="px-4 py-4">
                            <p className="text-[12px] font-semibold text-[#6b7280]">
                              Transcription: {m.transcript ? "Done" : "Pending"}
                            </p>
                            <div className="mt-3 flex items-center gap-3 rounded-lg bg-white border border-[#e5e7eb] px-4 py-3">
                              <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6366f1] text-white">
                                ▶
                              </button>
                              <div className="flex-1 h-2 rounded-full bg-[#e5e7eb]">
                                <div className="h-full w-1/3 rounded-full bg-[#6366f1]" />
                              </div>
                              <span className="text-[11px] text-[#9ca3af]">0:{String(m.durationSec).padStart(2, "0")}</span>
                            </div>
                            {m.transcript ? (
                              <p className="mt-3 text-[13px] text-[#374151]">{m.transcript}</p>
                            ) : (
                              <p className="mt-3 text-[13px] text-[#9ca3af]">Transcription not available.</p>
                            )}
                            <div className="mt-4 flex flex-wrap gap-2">
                              <PersonalOutlineButton>Call Back</PersonalOutlineButton>
                              <PersonalOutlineButton className="gap-1.5">
                                <Archive className="h-3.5 w-3.5" />
                                Archive
                              </PersonalOutlineButton>
                              <PersonalOutlineButton className="text-[#dc2626] border-[#fecaca]">
                                Delete
                              </PersonalOutlineButton>
                              <a
                                href={`/api/phone/voicemail/${m.id}/recording`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[12px] font-semibold text-[#6366f1] px-3 py-2"
                              >
                                Download
                              </a>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PersonalSection>

      <div className={pCard + " p-5"}>
        <h2 className="text-[15px] font-semibold text-[#111827]">Voicemail Settings</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <label className="text-[12px] font-medium text-[#6b7280]">Greeting to play</label>
            <select className="mt-1 h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
              <option>Default Greeting</option>
            </select>
            <div className="mt-2 flex gap-2">
              <PersonalOutlineButton>Upload New</PersonalOutlineButton>
              <PersonalOutlineButton>Record New</PersonalOutlineButton>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-[13px]">
              <span>Auto-Transcription</span>
              <input
                type="checkbox"
                checked={autoTranscription}
                onChange={(e) => setAutoTranscription(e.target.checked)}
              />
            </label>
            <label className="flex items-center justify-between text-[13px]">
              <span>Email Alerts</span>
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
              />
            </label>
            <div>
              <label className="text-[12px] font-medium text-[#6b7280]">Forward to Email</label>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[#e5e7eb] px-3 text-[13px]"
                placeholder="you@email.com"
                value={forwardEmail}
                onChange={(e) => setForwardEmail(e.target.value)}
              />
            </div>
          </div>
        </div>
        <PersonalPrimaryButton className="mt-4">Save Settings</PersonalPrimaryButton>
      </div>

      <PersonalSection title="Recent Activity">
        <ul className="space-y-2 text-[13px] text-[#6b7280]">
          {messages.slice(0, 3).map((m) => (
            <li key={m.id}>
              New voicemail from {formatPhone(m.callerNumber || "Unknown")} —{" "}
              {new Date(m.createdAt).toLocaleString()}
            </li>
          ))}
          {messages.length === 0 ? <li>No recent voicemail activity.</li> : null}
        </ul>
      </PersonalSection>
    </PersonalPageWrap>
  );
}
