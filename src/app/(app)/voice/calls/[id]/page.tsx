"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { RecordingPlayer } from "@/components/voice/recording-player";
import { VoiceSubNav } from "@/components/voice/voice-subnav";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function VoiceCallDetailPage() {
  const params = useParams();
  const id = String(params.id || "");
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/voice/calls/${id}`)
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => undefined);
  }, [id]);

  const call = data?.call as Record<string, unknown> | undefined;
  const recordings = (data?.recordings as Array<{ id: string; status: string }>) || [];

  return (
    <div>
      <PageHeader title="Call detail" description="Timeline, transcript, insights, transfers, and costs." />
      <VoiceSubNav />
      {!call ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-2 p-5">
            <CardTitle>Summary</CardTitle>
            <p className="text-sm"><strong>Status:</strong> {String(call.status)}</p>
            <p className="text-sm"><strong>From:</strong> {String(call.fromE164)}</p>
            <p className="text-sm"><strong>To:</strong> {String(call.toE164)}</p>
            <p className="text-sm"><strong>Outcome:</strong> {String(call.outcome || "—")}</p>
            <p className="text-sm"><strong>Cost:</strong> ${((Number(call.costCents) || 0) / 100).toFixed(2)}</p>
          </Card>
          <Card className="p-5">
            <CardTitle>Recording</CardTitle>
            {recordings.length ? (
              <div className="mt-2 space-y-4">
                {recordings.map((r) => (
                  <RecordingPlayer key={r.id} recordingId={r.id} label={r.status} />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">No recording for this call.</p>
            )}
          </Card>
          <Card className="p-5">
            <CardTitle>Transcript</CardTitle>
            <pre className="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap">
              {JSON.stringify(data?.transcripts, null, 2)}
            </pre>
          </Card>
          <Card className="p-5">
            <CardTitle>Insights</CardTitle>
            <pre className="mt-2 text-xs whitespace-pre-wrap">
              {JSON.stringify(data?.insights, null, 2)}
            </pre>
          </Card>
          <Card className="p-5 lg:col-span-2">
            <CardTitle>Event timeline</CardTitle>
            <pre className="mt-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap">
              {JSON.stringify(data?.events, null, 2)}
            </pre>
          </Card>
        </div>
      )}
      <p className="mt-6 text-sm">
        <Link href="/voice/calls" className="underline">← All calls</Link>
      </p>
    </div>
  );
}
