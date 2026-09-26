"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Phone } from "lucide-react";
import { Page, PageHeader, Panel } from "@/newui-transplant/components/app/kit";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";
import { OutcomePill } from "@/newui-transplant/components/app/status";
import { mapVoiceCallApiRowToNewUi, type VoiceCallApiRow } from "@/lib/newui-transplant/adapters/voice-calls";
import { fmtCallPhone } from "@/lib/voice/calls/display";

type CallDetailPayload = {
  call: VoiceCallApiRow & { summary?: string | null };
  transcripts?: Array<{ segments?: Array<{ speaker: string; text: string }> }>;
};

export function NewUiVoiceCallDetailPage({ callId }: { callId: string }) {
  const [detail, setDetail] = useState<CallDetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/voice/calls/${callId}`, { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((j) => setDetail((j.data ?? j) as CallDetailPayload))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [callId]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading call…</p>;
  }
  if (notFound || !detail?.call) {
    return <p className="p-6 text-sm text-muted-foreground">Call not found.</p>;
  }

  const vm = mapVoiceCallApiRowToNewUi(detail.call);
  const segments =
    detail.transcripts?.flatMap((t) => t.segments ?? []) ?? [];

  return (
    <Page>
      <Link href="/voice/calls" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> All calls
      </Link>
      <PageHeader
        title={vm.caller}
        status={<OutcomePill outcome={vm.outcome} />}
        meta={
          <span className="font-mono">
            {vm.phone} · {vm.date} {vm.time} · {vm.duration}
          </span>
        }
        actions={
          <ButtonLink href={`tel:${fmtCallPhone(detail.call.fromE164)}`}>
            <Phone /> Call back
          </ButtonLink>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Panel title="Summary">
            <p className="text-sm leading-relaxed text-muted-foreground">{vm.summary}</p>
          </Panel>
          <Panel title="Transcript">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transcript available.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {segments.map((seg, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{seg.speaker}: </span>
                    {seg.text}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
        <Panel title="Details">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Attention</dt>
              <dd>{vm.attention || "None"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Recording</dt>
              <dd>{vm.recording ? "Available" : "None"}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </Page>
  );
}
