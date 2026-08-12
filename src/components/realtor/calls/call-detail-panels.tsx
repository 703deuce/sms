"use client";

import type { RealtorCallRow } from "@/lib/realtor/calls-crm-mock";
import { JENNIFER_TRANSCRIPT } from "@/lib/realtor/calls-crm-mock";
import { cn } from "@/lib/utils";
import { Download, Play, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function CallDetailPanel({
  call,
  onClose,
  showTranscriptLink = true,
}: {
  call: RealtorCallRow;
  onClose: () => void;
  showTranscriptLink?: boolean;
}) {
  const directionLabel = call.direction === "inbound" ? "Inbound Call" : "Outbound Call";

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-[#e5e7eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
        <h3 className="text-[15px] font-bold text-[#111827]">Call Details</h3>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#f9fafb]" aria-label="Close">
          <X className="h-4 w-4 text-[#6b7280]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-[12px] font-semibold text-[#6b7280]">{directionLabel}</p>

        <div className="mt-4 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eff6ff] text-[18px] font-bold text-[#2563eb]">
            {call.callerInitials}
          </span>
          <p className="mt-3 text-[16px] font-bold text-[#111827]">{call.callerName}</p>
          <p className="text-[13px] text-[#6b7280]">{call.callerPhone}</p>
          <p className="mt-1 text-[12px] text-[#9ca3af]">{call.dateTime}</p>
          <p className="text-[13px] font-semibold text-[#111827]">{call.duration}</p>
        </div>

        <div className="mt-5 space-y-2 border-t border-[#e5e7eb] pt-4 text-[13px]">
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Answered by</span>
            <span className="font-medium text-[#111827]">{call.agent}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Outcome</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", call.outcomeClass)}>
              {call.outcome}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#6b7280]">Disposition</span>
            <span className="font-medium text-emerald-600">{call.disposition}</span>
          </div>
        </div>

        {call.hasRecording ? (
          <div className="mt-5 rounded-lg border border-[#e5e7eb] p-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white"
                aria-label="Play"
              >
                <Play className="h-4 w-4" />
              </button>
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-[#e5e7eb]">
                  <div className="h-full w-1/4 rounded-full bg-[#2563eb]" />
                </div>
                <p className="mt-1 text-[11px] text-[#9ca3af]">0:00 / {call.duration}</p>
              </div>
              <button type="button" className="text-[#6b7280]" aria-label="Download">
                <Download className="h-4 w-4" />
              </button>
            </div>
            {showTranscriptLink ? (
              <Link
                href="/realtor/calls/transcripts"
                className="mt-3 block w-full rounded-lg border border-[#e5e7eb] py-2 text-center text-[13px] font-semibold text-[#2563eb] hover:bg-[#f9fafb]"
              >
                View Transcript
              </Link>
            ) : null}
          </div>
        ) : null}

        <dl className="mt-5 space-y-2 border-t border-[#e5e7eb] pt-4 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-[#6b7280]">From</dt>
            <dd className="font-medium">{call.callerPhone}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#6b7280]">To</dt>
            <dd className="font-medium">{call.number}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[#6b7280]">Agent</dt>
            <dd className="font-medium">{call.agent}</dd>
          </div>
          {call.aiModel ? (
            <div className="flex justify-between">
              <dt className="text-[#6b7280]">AI Model</dt>
              <dd className="font-medium">{call.aiModel}</dd>
            </div>
          ) : null}
        </dl>

        {call.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {call.tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  tag === "New Lead" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700",
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {call.notes ? (
          <div className="mt-4">
            <p className="text-[12px] font-semibold text-[#6b7280]">Notes</p>
            <p className="mt-1 text-[13px] text-[#374151]">{call.notes}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function TranscriptDetailPanel({
  call,
  onClose,
}: {
  call: RealtorCallRow;
  onClose: () => void;
}) {
  const [panelTab, setPanelTab] = useState<"transcript" | "summary">("transcript");

  return (
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-[#e5e7eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
        <h3 className="text-[15px] font-bold text-[#111827]">Transcript Details</h3>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#f9fafb]" aria-label="Close">
          <X className="h-4 w-4 text-[#6b7280]" />
        </button>
      </div>

      <div className="border-b border-[#e5e7eb] p-4">
        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
          {call.agentType === "ai" ? "AI Call" : "Human Call"}
        </span>
        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          Answered
        </span>
        <p className="mt-3 text-[16px] font-bold text-[#111827]">{call.callerName}</p>
        <p className="text-[12px] text-[#6b7280]">
          {call.dateTime} · {call.duration} · {call.agent}
        </p>
      </div>

      <div className="flex border-b border-[#e5e7eb] px-4">
        {(["transcript", "summary"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setPanelTab(t)}
            className={cn(
              "border-b-2 px-3 py-2 text-[13px] font-semibold capitalize",
              panelTab === t ? "border-[#2563eb] text-[#2563eb]" : "border-transparent text-[#6b7280]",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {panelTab === "transcript" ? (
          <div className="space-y-4">
            {(call.id === "call-1" ? JENNIFER_TRANSCRIPT : JENNIFER_TRANSCRIPT.slice(0, 4)).map((line, i) => (
              <div key={i}>
                <p
                  className={cn(
                    "text-[12px] font-semibold",
                    line.role === "ai" ? "text-purple-700" : "text-[#2563eb]",
                  )}
                >
                  {line.speaker}
                </p>
                <p className="mt-1 text-[13px] text-[#374151]">{line.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[#374151]">
            Caller is a motivated buyer looking for a 3-bedroom home around $500k in Woodbridge. Appointment
            booked for buyer consultation.
          </p>
        )}
      </div>

      <div className="border-t border-[#e5e7eb] p-4">
        <div className="flex items-center gap-3">
          <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white">
            <Play className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <div className="h-1.5 rounded-full bg-[#e5e7eb]">
              <div className="h-full w-1/4 rounded-full bg-[#2563eb]" />
            </div>
            <p className="mt-1 text-[11px] text-[#9ca3af]">0:00 / {call.duration}</p>
          </div>
          <select className="rounded border border-[#e5e7eb] px-2 py-1 text-[11px]">
            <option>1x</option>
          </select>
        </div>
        <button type="button" className="realtor-btn-outline mt-3 w-full">
          <Download className="h-4 w-4" />
          Download Transcript
        </button>
      </div>
    </aside>
  );
}

export function RecordingDetailPanel({
  call,
  onClose,
}: {
  call: RealtorCallRow;
  onClose: () => void;
}) {
  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-[#e5e7eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
        <h3 className="text-[15px] font-bold text-[#111827]">Recording Details</h3>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#f9fafb]" aria-label="Close">
          <X className="h-4 w-4 text-[#6b7280]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
          {call.agentType === "ai" ? "AI Call" : "Human Call"}
        </span>
        <div className="mt-4 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-purple-50 text-[18px] font-bold text-purple-700">
            {call.callerInitials}
          </span>
          <p className="mt-3 text-[16px] font-bold">{call.callerName}</p>
          <p className="text-[13px] text-[#6b7280]">{call.callerPhone}</p>
          <p className="mt-1 text-[12px] text-[#9ca3af]">{call.dateTime}</p>
          <p className="font-semibold">{call.duration}</p>
          <p className="text-[12px] text-[#6b7280]">{call.agent}</p>
        </div>

        <div className="mt-5 rounded-lg bg-[#f9fafb] p-4">
          <div className="flex h-12 items-end gap-0.5">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="w-1 rounded-sm bg-[#2563eb]/60"
                style={{ height: `${20 + (i % 5) * 12}%` }}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white">
              <Play className="h-4 w-4" />
            </button>
            <div className="flex-1">
              <div className="h-1.5 rounded-full bg-[#e5e7eb]">
                <div className="h-full w-1/4 rounded-full bg-[#2563eb]" />
              </div>
              <p className="mt-1 text-[11px] text-[#9ca3af]">00:00 / {call.duration}</p>
            </div>
            <select className="rounded border border-[#e5e7eb] px-2 py-1 text-[11px]">
              <option>1x</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" className="realtor-btn-primary flex-1">
              <Download className="h-4 w-4" />
              Download
            </button>
            <button type="button" className="realtor-btn-outline flex-1">Share</button>
          </div>
        </div>

        <dl className="mt-5 space-y-2 text-[13px]">
          {[
            ["Direction", call.direction === "inbound" ? "Inbound" : "Outbound"],
            ["Channel", "Phone Call"],
            ["Outcome", call.outcome],
            ["Disposition", call.disposition],
            ["Agent", call.agent],
            ...(call.aiModel ? [["AI Model", call.aiModel] as const] : []),
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-[#6b7280]">{label}</dt>
              <dd className="font-medium text-[#111827]">{value}</dd>
            </div>
          ))}
        </dl>

        {call.tags?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {call.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {call.notes ? (
          <div className="mt-4">
            <p className="text-[12px] font-semibold text-[#6b7280]">Notes</p>
            <p className="mt-1 text-[13px]">{call.notes}</p>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

export function VoicemailDetailPanel({
  call,
  onClose,
}: {
  call: RealtorCallRow;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(call.notes || "");

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-l border-[#e5e7eb] bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e7eb] px-4 py-3">
        <h3 className="text-[15px] font-bold text-[#111827]">Voicemail Details</h3>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-[#f9fafb]" aria-label="Close">
          <X className="h-4 w-4 text-[#6b7280]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eff6ff] text-[18px] font-bold text-[#2563eb]">
            {call.callerInitials}
          </span>
          <p className="mt-3 text-[16px] font-bold">{call.callerName}</p>
          <p className="text-[13px] text-[#6b7280]">{call.callerPhone}</p>
        </div>

        <p className="mt-4 text-[12px] text-[#6b7280]">{call.dateTime}</p>
        <p className="text-[13px] font-semibold">{call.duration}</p>
        <p className="text-[12px] text-[#6b7280]">
          {call.agent} · {call.number}
        </p>

        <div className="mt-5 rounded-lg border border-[#e5e7eb] p-3">
          <div className="flex items-center gap-3">
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2563eb] text-white">
              <Play className="h-4 w-4" />
            </button>
            <div className="flex flex-1 items-end gap-0.5">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="h-6 w-1 rounded-sm bg-[#2563eb]/50" style={{ height: `${8 + (i % 4) * 6}px` }} />
              ))}
            </div>
            <select className="rounded border border-[#e5e7eb] px-2 py-1 text-[11px]">
              <option>1x</option>
            </select>
          </div>
          <p className="mt-2 text-[11px] text-[#9ca3af]">00:00 / {call.duration}</p>
          <button type="button" className="mt-2 text-[13px] font-semibold text-[#2563eb]">Download Recording</button>
        </div>

        <div className="mt-5">
          <label className="text-[12px] font-semibold text-[#6b7280]">Disposition</label>
          <select className="mt-1 h-9 w-full rounded-lg border border-[#e5e7eb] px-3 text-[13px]">
            <option>{call.disposition}</option>
            <option>New</option>
            <option>Contacted</option>
            <option>Not Interested</option>
          </select>
        </div>

        <div className="mt-4">
          <label className="text-[12px] font-semibold text-[#6b7280]">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this voicemail..."
            className="mt-1 min-h-[100px] w-full rounded-lg border border-[#e5e7eb] px-3 py-2 text-[13px]"
          />
          <p className="mt-1 text-right text-[11px] text-[#9ca3af]">{notes.length} / 500</p>
        </div>
      </div>
    </aside>
  );
}
