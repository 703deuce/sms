"use client";

import { Card, StatCard } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useEffect, useState } from "react";

type ClickReport = {
  totalClicks: number;
  uniqueContacts: number;
  byCampaign: Record<string, number>;
  recent: Array<{
    id: string;
    phone?: string | null;
    contactId?: string | null;
    campaignId?: string | null;
    destinationUrl?: string | null;
    createdAt: string;
  }>;
};

export default function LinkTrackingPage() {
  const [data, setData] = useState<ClickReport | null>(null);

  useEffect(() => {
    fetch("/api/links/clicks?days=30")
      .then((r) => r.json())
      .then((j) => setData(j.data));
  }, []);

  return (
    <div>
      <PageHeader
        title="Link tracking"
        description="Short links, unique and total clicks, per-contact attribution, and campaign CTR."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total clicks (30d)" value={String(data?.totalClicks ?? 0)} />
        <StatCard label="Unique contacts" value={String(data?.uniqueContacts ?? 0)} />
        <StatCard label="Campaign sources" value={String(Object.keys(data?.byCampaign ?? {}).length)} />
      </div>
      <Card className="overflow-hidden p-0">
        <Table>
          <THead>
            <TR>
              <TH>Time</TH>
              <TH>Phone / contact</TH>
              <TH>Campaign</TH>
              <TH>Destination</TH>
            </TR>
          </THead>
          <TBody>
            {(data?.recent ?? []).map((c) => (
              <TR key={c.id}>
                <TD>{new Date(c.createdAt).toLocaleString()}</TD>
                <TD>{c.phone || c.contactId || "—"}</TD>
                <TD className="font-mono text-xs">{c.campaignId || "direct"}</TD>
                <TD className="max-w-xs truncate text-xs">{c.destinationUrl || "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
