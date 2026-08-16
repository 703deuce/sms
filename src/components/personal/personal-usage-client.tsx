"use client";

import type { PersonalUsageSummary, PersonalNumberRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  PersonalPageHeader,
  PersonalPageWrap,
  PersonalStatCard,
  PersonalSection,
  pMuted,
} from "./personal-ui";

export function PersonalUsageClient({ numbers }: { numbers: PersonalNumberRow[] }) {
  const [usage, setUsage] = useState<PersonalUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/personal/usage")
      .then((r) => r.json())
      .then((j) => {
        setUsage(j.data ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !usage) {
    return (
      <PersonalPageWrap>
        <p className={pMuted}>Loading usage…</p>
      </PersonalPageWrap>
    );
  }

  const pct = Math.min(
    100,
    Math.round((usage.forwardingMinutesUsed / usage.forwardingMinutesLimit) * 100),
  );

  return (
    <PersonalPageWrap>
      <PersonalPageHeader
        title="Usage"
        description="Forwarding minutes for your current billing period."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PersonalStatCard
          label="Forwarding minutes"
          value={`${usage.forwardingMinutesUsed} / ${usage.forwardingMinutesLimit}`}
          sub={`${usage.forwardingMinutesRemaining} remaining`}
        />
        <PersonalStatCard
          label="Estimated overage"
          value={usage.estimatedOverageMinutes}
          sub="minutes"
        />
        <PersonalStatCard
          label="Period ends"
          value={new Date(usage.billingPeriodEnd).toLocaleDateString()}
        />
      </div>

      <div className="h-3 w-full max-w-md rounded-full bg-[#e5e7eb]">
        <div
          className="h-3 rounded-full bg-[#6366f1]"
          style={{ width: `${pct}%` }}
        />
      </div>

      <PersonalSection title="Per number">
        <ul className="space-y-2 text-[13px]">
          {numbers.map((n) => {
            const row = usage.perNumber.find((p) => p.numberId === n.id);
            return (
              <li key={n.id} className="flex justify-between">
                <span>{formatPhone(n.number)}</span>
                <span>{row?.forwardingMinutes ?? 0} min</span>
              </li>
            );
          })}
        </ul>
      </PersonalSection>
    </PersonalPageWrap>
  );
}
