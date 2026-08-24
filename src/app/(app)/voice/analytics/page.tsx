"use client";

import { Card, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatNumber } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";

type MctbAnalytics = {
  range: string;
  totalMissed: number;
  textsSent: number;
  suppressed: number;
  uniqueCallers: number;
  repeatCallers: number;
  replies: number;
  replyRate: number;
  deliveryRate: number;
};

export default function MctbAnalyticsPage() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [mctb, setMctb] = useState<MctbAnalytics | null>(null);

  useEffect(() => {
    fetch(`/api/mctb/analytics?range=${range}`)
      .then((r) => r.json())
      .then((j) => setMctb(j.data))
      .catch(() => undefined);
  }, [range]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Missed call recovery performance — texts sent, delivery, replies, and repeat callers."
        actions={
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm"
            value={range}
            onChange={(e) => setRange(e.target.value as "7d" | "30d" | "90d")}
          >
            <option value="7d">7 days</option>
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Missed calls" value={formatNumber(mctb?.totalMissed ?? 0)} />
        <StatCard label="Texts sent" value={formatNumber(mctb?.textsSent ?? 0)} />
        <StatCard label="Delivery rate" value={`${mctb?.deliveryRate ?? 0}%`} />
        <StatCard label="Reply rate" value={`${mctb?.replyRate ?? 0}%`} />
        <StatCard label="Customer replies" value={formatNumber(mctb?.replies ?? 0)} />
        <StatCard label="Suppressed" value={formatNumber(mctb?.suppressed ?? 0)} />
        <StatCard label="Unique callers" value={formatNumber(mctb?.uniqueCallers ?? 0)} />
        <StatCard label="Repeat callers" value={formatNumber(mctb?.repeatCallers ?? 0)} />
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        <Link href="/voice/missed-calls" className="font-semibold text-primary hover:underline">
          View missed call log →
        </Link>
        {" · "}
        <Link href="/voice/reports" className="font-semibold text-primary hover:underline">
          Overall reports (all products) →
        </Link>
      </p>
    </div>
  );
}
