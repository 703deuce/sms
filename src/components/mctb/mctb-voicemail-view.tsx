"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseVoicemailApiPayload } from "@/lib/personal/voicemail-mappers";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import { formatPhone } from "@/lib/utils";
import { MessageSquare, Phone, Search, Settings, Voicemail } from "lucide-react";
import { MctbEmptyState, MctbPageHeader } from "@/components/mctb/kimi-ui/mctb-premium-patterns";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./kimi-ui/reference.css";

type VmMessage = {
  id: string;
  callerNumber: string;
  durationSec: number;
  createdAt: string;
  transcript?: string | null;
  summary?: string | null;
  readAt: string | null;
};

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MctbVoicemailView({ initialId }: { initialId?: string }) {
  const [messages, setMessages] = useState<VmMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/phone/voicemail", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error("load failed");
      const { messages: rows } = parseVoicemailApiPayload(json.data);
      const mapped: VmMessage[] = rows.map((m) => ({
        id: m.id,
        callerNumber: m.callerNumber,
        durationSec: m.durationSec,
        createdAt: m.createdAt,
        transcript: m.transcript,
        summary: m.summary,
        readAt: m.readAt ?? null,
      }));
      setMessages(mapped);
      if (!selectedId && mapped[0]) setSelectedId(mapped[0].id);
    } catch {
      setError(true);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return messages;
    return messages.filter(
      (m) =>
        m.callerNumber.includes(term) ||
        (m.transcript || "").toLowerCase().includes(term) ||
        (m.summary || "").toLowerCase().includes(term),
    );
  }, [messages, q]);

  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="mctb-page">
      <div className="mctb-page-inner">
        <MctbPageHeader
          title="Voicemail"
          description="Listen to messages, read transcripts, and follow up on missed callers."
          action={
            <Link
              href={MCTB_ROUTES.setupVoicemail}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-indigo-100 bg-white/90 px-4 text-[13px] font-semibold text-gray-700 shadow-[0_2px_8px_rgba(79,70,229,0.06)] transition hover:border-indigo-200 hover:shadow-sm"
            >
              <Settings size={15} aria-hidden />
              Voicemail settings
            </Link>
          }
        />

        {loading ? (
          <div className="ref-deco-section p-12 text-center text-sm text-gray-500" aria-busy="true">
            Loading voicemail…
          </div>
        ) : error ? (
          <div className="ref-deco-section p-8 text-center">
            <p className="text-sm font-medium text-gray-900">Voicemail couldn&apos;t be loaded.</p>
            <Button type="button" size="sm" className="mt-4" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : messages.length === 0 ? (
          <MctbEmptyState
            icon={Voicemail}
            title="No voicemails yet"
            description="When callers leave a message on your business line, it will appear here with transcript and summary."
            action={
              <Link
                href={MCTB_ROUTES.setupVoicemail}
                className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(79,70,229,0.22)]"
              >
                Configure voicemail
              </Link>
            }
          />
        ) : (
          <div className="mctb-master-detail">
            <div className="ref-deco-section flex flex-col overflow-hidden">
              <div className="border-b border-gray-100 p-3">
                <label className="sr-only" htmlFor="mctb-vm-search">Search voicemail</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
                  <Input
                    id="mctb-vm-search"
                    className="pl-9"
                    placeholder="Search caller or transcript"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
              </div>
              <ul className="max-h-[32rem] divide-y divide-gray-100 overflow-y-auto">
                {filtered.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(m.id)}
                      className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition ${
                        selected?.id === m.id
                          ? "bg-gradient-to-r from-indigo-50/90 to-violet-50/40 shadow-[inset_3px_0_0_#6366f1]"
                          : "hover:bg-gray-50/90"
                      }`}
                    >
                      <div className="avatar av-purple mt-0.5 text-[11px]">
                        {(m.callerNumber.replace(/\D/g, "").slice(-2) || "?").slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold text-gray-900">
                            {formatPhone(m.callerNumber)}
                          </span>
                          {!m.readAt ? (
                            <span className="ref-pill pill-purple">New</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-gray-500">
                          {m.summary || m.transcript || "No transcript yet"}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-400">
                          {fmtWhen(m.createdAt)} · {fmtDuration(m.durationSec)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {selected ? (
              <div className="ref-deco-section ref-deco-section--tint-purple flex flex-col">
                <div className="ref-deco-section-body flex flex-col p-0 sm:p-0">
                <div className="flex flex-col p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <h2 className="text-[18px] font-bold text-gray-900">
                      {formatPhone(selected.callerNumber)}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-gray-500">
                      {fmtWhen(selected.createdAt)} · {fmtDuration(selected.durationSec)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`tel:${selected.callerNumber}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <Phone size={14} aria-hidden />
                      Call back
                    </a>
                    <Link
                      href={`/conversations?product=mctb&q=${encodeURIComponent(selected.callerNumber)}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      <MessageSquare size={14} aria-hidden />
                      Open conversation
                    </Link>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Original recording
                    </p>
                    <audio
                      controls
                      className="mt-2 w-full"
                      src={`/api/phone/voicemail/${selected.id}/recording`}
                      preload="metadata"
                    >
                      Your browser does not support audio playback.
                    </audio>
                  </div>

                  {selected.summary ? (
                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-800">
                        AI summary
                      </p>
                      <p className="mt-2 text-[13px] leading-relaxed text-gray-800">{selected.summary}</p>
                      <p className="mt-2 text-[11px] text-indigo-700/80">Generated summary — not verbatim speech.</p>
                    </div>
                  ) : null}

                  {selected.transcript ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                        Transcript
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
                        {selected.transcript}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[13px] text-gray-500">Transcript pending or unavailable.</p>
                  )}
                </div>
                </div>
                </div>
              </div>
            ) : (
              <div className="ref-deco-empty flex items-center justify-center p-12 text-sm text-gray-500">
                Select a voicemail to listen.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
