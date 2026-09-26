"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Page, PageHeader, Panel } from "@/newui-transplant/components/app/kit";
import { RecoveryPill } from "@/newui-transplant/components/app/status";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";

type MissedCallDetail = {
  id: string;
  callerLabel?: string;
  callerE164?: string;
  detectedAt?: string;
  status?: string;
  recoveryLabel?: string;
  suppressionReason?: string | null;
  timeline?: Array<{ label: string; at?: string }>;
};

export function NewUiMctbMissedCallDetailPage({ eventId }: { eventId: string }) {
  const [detail, setDetail] = useState<MissedCallDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/mctb/missed-calls/${eventId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setDetail((j.data ?? j) as MissedCallDetail))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading missed call…</p>;
  if (!detail) return <p className="p-6 text-sm text-muted-foreground">Missed call not found.</p>;

  const title = detail.callerLabel || detail.callerE164 || "Missed call";

  return (
    <Page>
      <Link href="/mctb/missed-calls" className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" aria-hidden="true" /> Missed calls
      </Link>
      <PageHeader
        title={title}
        status={<RecoveryPill status={(detail.recoveryLabel as any) || "Sent"} />}
        meta={detail.detectedAt ? new Date(detail.detectedAt).toLocaleString() : undefined}
        actions={<ButtonLink href={`/mctb/conversations`} variant="outline">Open conversation</ButtonLink>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Recovery">
          <p className="text-sm text-muted-foreground">Status: {detail.status || "—"}</p>
          {detail.suppressionReason ? (
            <p className="mt-2 text-sm">Suppressed: {detail.suppressionReason}</p>
          ) : null}
        </Panel>
        <Panel title="Timeline">
          {detail.timeline?.length ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {detail.timeline.map((step, i) => (
                <li key={i}>{step.label}</li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Timeline loads from runtime events.</p>
          )}
        </Panel>
      </div>
    </Page>
  );
}
